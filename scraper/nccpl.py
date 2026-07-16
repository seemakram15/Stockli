"""
NCCPL FIPI/LIPI scraper.

NCCPL (nccpl.com.pk) sits behind Cloudflare and its Market Information page is a
client-rendered SPA, so a plain HTTP fetch gets a 403 challenge page. We drive a
real (stealth) browser via Scrapling to load the page, solve the Cloudflare
challenge, then replay the same tab-click -> date-fill -> search-click flow a
human does, capturing the resulting JSON XHR responses.

Discovered contract (via manual DevTools inspection, 2026-07):
  Tab              Date input id              Search button id      POST endpoint
  FIPI Normal      fipiNormalDateFilter        fipiNormalSearchBtn    /api/fipi-normal/data
  FIPI Sector Wise fipiSectorFromDateFilter     fipiSectorSearchBtn    /api/fipi-sector-wise/data
  LIPI Normal      lipiNormalDateFilter         lipiNormalSearchBtn    /api/lipi-normal/data
  LIPI Sector Wise lipiSectorFromDateFilter     lipiSectorSearchBtn    /api/lipi-sector-wise/data

Each POST body is {"date": "YYYY-MM-DD"} and each JSON response is
{"success": true, "records": [...], "count": N, "date": "..."} where a record
looks like (sector-wise adds SEC_CODE/SECTOR_NAME):
  {"CLIENT_TYPE": "FOREIGN CORPORATES ", "MARKET_TYPE": "REG"|"TOTAL"|"GRAND-TOTAL",
   "BUY_VOLUME": "3380446", "BUY_VALUE": "208988540", "SELL_VOLUME": "-1526097",
   "SELL_VALUE": "-366924795", "NET_VOLUME": "1854349", "NET_VALUE": "-157936255",
   "USD": "-568116"}

Values are plain numeric strings (no thousands separators); negative numbers
carry a leading "-". NET_VALUE is PKR; USD is the same net already converted
to US dollars by NCCPL — that's the "absolute USD" figure our app stores.

Cloudflare appears to rate-limit/flag rapid-fire automated requests even within
an already-solved session, so the four report fetches are spaced out with a
short random delay rather than fired back-to-back.
"""

from __future__ import annotations

import json
import random
import re
from dataclasses import dataclass, field

from scrapling.fetchers import StealthyFetcher

BASE_URL = "https://www.nccpl.com.pk/market-information"

REPORTS = [
    ("FIPI Normal", "fipiNormalDateFilter", "fipiNormalSearchBtn", "/api/fipi-normal/data"),
    ("FIPI Sector Wise", "fipiSectorFromDateFilter", "fipiSectorSearchBtn", "/api/fipi-sector-wise/data"),
    ("LIPI Normal", "lipiNormalDateFilter", "lipiNormalSearchBtn", "/api/lipi-normal/data"),
    ("LIPI Sector Wise", "lipiSectorFromDateFilter", "lipiSectorSearchBtn", "/api/lipi-sector-wise/data"),
]

FIPI_CATEGORIES = ["Foreign Corporate", "Foreign Individual", "Overseas Pakistani"]
LIPI_CATEGORIES = [
    "Individuals",
    "Companies",
    "Banks / DFI",
    "NBFC",
    "Mutual Funds",
    "Other",
    "Brokers",
    "Insurance",
]
FLOW_SECTORS = [
    "Banks",
    "OMCs",
    "E&Ps",
    "Cement",
    "Fertilizer",
    "FMCGs",
    "IPPs",
    "Telecom",
    "Textile",
    "Others",
    "Debt Mkt.",
]

# Real NCCPL CLIENT_TYPE / SECTOR_NAME strings vary in casing/spacing and
# occasionally in wording, so map by keyword rather than exact string.
_FIPI_KEYWORDS = [
    ("CORPORATE", "Foreign Corporate"),
    ("INDIVIDUAL", "Foreign Individual"),
    ("OVERSEAS", "Overseas Pakistani"),
]
_LIPI_KEYWORDS = [
    ("INDIVIDUAL", "Individuals"),
    ("COMPAN", "Companies"),
    ("BANK", "Banks / DFI"),
    ("DFI", "Banks / DFI"),
    ("NBFC", "NBFC"),
    ("MUTUAL", "Mutual Funds"),
    ("FUND", "Mutual Funds"),
    ("BROKER", "Brokers"),
    ("INSURANCE", "Insurance"),
]
_SECTOR_KEYWORDS = [
    ("BANK", "Banks"),
    ("OIL AND GAS MARKETING", "OMCs"),
    ("OIL AND GAS EXPLORATION", "E&Ps"),
    ("EXPLORATION", "E&Ps"),
    ("CEMENT", "Cement"),
    ("FERTILIZER", "Fertilizer"),
    ("FOOD", "FMCGs"),
    ("PERSONAL CARE", "FMCGs"),
    ("POWER GENERATION", "IPPs"),
    ("TECHNOLOGY", "Telecom"),
    ("COMMUNICATION", "Telecom"),
    ("TEXTILE", "Textile"),
    ("DEBT MARKET", "Debt Mkt."),
]


def _match_keyword(value: str, table: list[tuple[str, str]], default: str) -> str:
    upper = (value or "").strip().upper()
    for needle, bucket in table:
        if needle in upper:
            return bucket
    return default


def _num(raw) -> float:
    if raw is None:
        return 0.0
    try:
        return float(str(raw).replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


@dataclass
class CategoryRow:
    label: str
    buy: float = 0.0
    sell: float = 0.0
    net: float = 0.0
    sectors: list[float] = field(default_factory=lambda: [0.0] * len(FLOW_SECTORS))

    def to_dict(self) -> dict:
        return {"label": self.label, "buy": self.buy, "sell": self.sell, "net": self.net, "sectors": self.sectors}


def _empty_rows(categories: list[str]) -> dict[str, CategoryRow]:
    return {label: CategoryRow(label=label) for label in categories}


def _accumulate_normal(rows: dict[str, CategoryRow], records: list[dict], keyword_table, default_label: str) -> None:
    """FIPI/LIPI Normal report: one row per CLIENT_TYPE, MARKET_TYPE=='TOTAL' is that client's grand total across market types."""
    for rec in records:
        if (rec.get("MARKET_TYPE") or "").strip().upper() != "TOTAL":
            continue
        label = _match_keyword(rec.get("CLIENT_TYPE", ""), keyword_table, default_label)
        row = rows.setdefault(label, CategoryRow(label=label))
        # USD is NCCPL's own PKR->USD converted net; buy/sell only exist in PKR,
        # so scale them by the same net ratio to keep everything in one currency.
        net_pkr = _num(rec.get("NET_VALUE"))
        net_usd = _num(rec.get("USD"))
        scale = (net_usd / net_pkr) if net_pkr else 0.0
        row.buy += _num(rec.get("BUY_VALUE")) * scale
        row.sell += abs(_num(rec.get("SELL_VALUE"))) * scale
        row.net += net_usd


def _accumulate_sectors(rows: dict[str, CategoryRow], records: list[dict], keyword_table, default_label: str) -> None:
    """FIPI/LIPI Sector Wise report: one row per (CLIENT_TYPE, SECTOR_NAME, MARKET_TYPE); skip the per-client TOTAL rows (blank sector) to avoid double counting."""
    for rec in records:
        sector_name = (rec.get("SECTOR_NAME") or "").strip()
        if not sector_name or sector_name == "---":
            continue
        label = _match_keyword(rec.get("CLIENT_TYPE", ""), keyword_table, default_label)
        row = rows.setdefault(label, CategoryRow(label=label))
        sector_idx = FLOW_SECTORS.index(_match_keyword(sector_name, _SECTOR_KEYWORDS, "Others"))
        row.sectors[sector_idx] += _num(rec.get("USD"))


def _totals(rows: dict[str, CategoryRow], categories: list[str]) -> tuple[list[dict], dict]:
    ordered = [rows.get(label, CategoryRow(label=label)) for label in categories]
    total = CategoryRow(label="Net")
    for row in ordered:
        total.buy += row.buy
        total.sell += row.sell
        total.net += row.net
        total.sectors = [a + b for a, b in zip(total.sectors, row.sectors)]
    return [r.to_dict() for r in ordered], total.to_dict()


def _click_and_search(page, date_input_id: str, search_btn_id: str, date: str) -> None:
    page.evaluate(
        """([id, value]) => {
            const el = document.getElementById(id);
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }""",
        [date_input_id, date],
    )
    page.click(f"#{search_btn_id}")


def scrape_day(date: str) -> dict:
    """Scrape one trading day. `date` is YYYY-MM-DD. Returns a dict matching the
    Node app's FipiLipiDay shape (fytd/cytd are computed later, Node-side)."""

    captured: dict[str, list[bytes]] = {}

    def page_action(page):
        page.wait_for_load_state("networkidle", timeout=30_000)

        def on_response(response):
            for _, _, _, endpoint in REPORTS:
                if response.url.endswith(endpoint) and response.request.method == "POST":
                    try:
                        captured.setdefault(endpoint, []).append(response.body())
                    except Exception:
                        pass

        page.on("response", on_response)

        for i, (tab_label, date_input_id, search_btn_id, endpoint) in enumerate(REPORTS):
            tab = page.locator("ul.nav-tabs-custom li.nav-item", has_text=tab_label).first
            tab.click()
            page.wait_for_timeout(random.randint(400, 900))
            _click_and_search(page, date_input_id, search_btn_id, date)
            page.wait_for_timeout(random.randint(1500, 2800))

        return page

    StealthyFetcher.fetch(
        BASE_URL,
        headless=True,
        solve_cloudflare=True,
        network_idle=True,
        page_action=page_action,
        timeout=90_000,
    )

    parsed: dict[str, list[dict]] = {}
    for endpoint, bodies in captured.items():
        if not bodies:
            continue
        try:
            payload = json.loads(bodies[-1])
        except (json.JSONDecodeError, TypeError):
            continue
        parsed[endpoint] = payload.get("records", [])

    fipi_rows = _empty_rows(FIPI_CATEGORIES)
    lipi_rows = _empty_rows(LIPI_CATEGORIES)

    if "/api/fipi-normal/data" in parsed:
        _accumulate_normal(fipi_rows, parsed["/api/fipi-normal/data"], _FIPI_KEYWORDS, "Foreign Corporate")
    if "/api/lipi-normal/data" in parsed:
        _accumulate_normal(lipi_rows, parsed["/api/lipi-normal/data"], _LIPI_KEYWORDS, "Other")
    if "/api/fipi-sector-wise/data" in parsed:
        _accumulate_sectors(fipi_rows, parsed["/api/fipi-sector-wise/data"], _FIPI_KEYWORDS, "Foreign Corporate")
    if "/api/lipi-sector-wise/data" in parsed:
        _accumulate_sectors(lipi_rows, parsed["/api/lipi-sector-wise/data"], _LIPI_KEYWORDS, "Other")

    fipi_list, fipi_net = _totals(fipi_rows, FIPI_CATEGORIES)
    lipi_list, lipi_net = _totals(lipi_rows, LIPI_CATEGORIES)

    missing = [ep for _, _, _, ep in REPORTS if ep not in parsed]

    return {
        "date": date,
        "fipi": fipi_list,
        "fipiNet": fipi_net,
        "lipi": lipi_list,
        "lipiNet": lipi_net,
        "missingReports": missing,
    }
