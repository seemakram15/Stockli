import "server-only";
import { parse } from "node-html-parser";
import { getStaleCached } from "@/lib/cache/stale";
import { PSX_TIMEZONE } from "@/lib/constants";
import {
  psxClosedMaxStaleSeconds,
  psxLiveCacheTtlSeconds,
  shouldRefreshPsxData,
} from "@/lib/psx/market-hours";
import { getSeedTicker } from "@/lib/psx/symbols";
import { getMarketRows } from "@/lib/services/prices";

const USER_AGENT =
  "Mozilla/5.0 (compatible; Stockli/1.0; +https://mystockli.qzz.io)";
const REQUEST_TIMEOUT_MS = 8_000;
const DAILY_TTL_SECONDS = 30 * 60;
const DAILY_STALE_SECONDS = 7 * 24 * 60 * 60;

const SOURCES = {
  usefulLinks: "https://ksestocks.com/blog/useful-links-psx/",
  boardMeetingsPrimary: "https://scstrade.com/MarketStatistics/MS_BoardMeetings.aspx",
  boardMeetingsFallback: "https://ksestocks.com/blog/psx-kse-board-meetings-schedule/",
  bookClosuresPrimary: "https://scstrade.com/MarketStatistics/MS_xDates.aspx",
  bookClosuresFallback: "https://www.ksestocks.com/BookClosures",
  dividendPrimary: "https://dps.psx.com.pk/payouts",
  dividendFallback: "https://ksestocks.com/blog/dividend-schedule/",
  pivotReference: "https://www.ksestocks.com/PivotPoints",
};

export interface UsefulLinkItem {
  title: string;
  description: string;
  href: string;
  category: string;
  official?: boolean;
}

export interface UsefulLinkGroup {
  title: string;
  description: string;
  links: UsefulLinkItem[];
}

export interface UsefulLinksData {
  groups: UsefulLinkGroup[];
  updatedAt: string;
  sourceUrl: string;
}

export interface BoardMeetingRow {
  id: string;
  symbol: string | null;
  company: string;
  meetingDate: string;
  meetingTime: string;
  subject: string;
  sourceLabel: string;
}

export interface BoardMeetingsData {
  rows: BoardMeetingRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
}

export interface BookClosureRow {
  id: string;
  symbol: string;
  company: string;
  faceValue: string;
  bookClosureFrom: string;
  bookClosureTo: string;
  payout: string;
  lastClose: string;
  sourceLabel: string;
}

export interface BookClosuresData {
  rows: BookClosureRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
}

export interface DividendHistoryRow {
  id: string;
  symbol: string;
  payout: string;
  creditedOn: string;
  sourceLabel: string;
}

export interface DividendHistoryData {
  rows: DividendHistoryRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
}

export interface PivotPointRow {
  symbol: string;
  companyName: string;
  sector: string;
  current: number;
  high: number;
  low: number;
  previousClose: number;
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  range: number;
  capturedAt: string | null;
}

export interface PivotPointsData {
  rows: PivotPointRow[];
  updatedAt: string;
  sourceUrl: string;
  sourceLabel: string;
  method: string;
}

interface KseBookClosuresPayload {
  cur?: KseBookClosureRaw[];
  old?: KseBookClosureRaw[];
}

interface KseBookClosureRaw {
  symbol?: string;
  cname?: string;
  faceval?: string;
  bcfrom?: string;
  bcto?: string;
  payout?: string;
  lc?: string;
}

interface SscBoardMeetingRaw {
  company_code?: string;
  company_name?: string;
  bm_date?: string;
  bm_time?: string;
  bm_place?: string;
  bm_year?: string;
  bm_quarter_number?: string;
}

interface SscBookClosureRaw {
  company_code?: string;
  company_name?: string;
  bm_dividend?: string;
  bm_bonus?: string;
  bm_right_per?: string;
  bm_bc_exp?: string;
}

export async function getUsefulLinksData(): Promise<UsefulLinksData> {
  return {
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.usefulLinks,
    groups: [
      {
        title: "Economy",
        description: "Macro calendars, inflation, trade and rates resources for Pakistan.",
        links: [
          {
            title: "SBP Monetary Policy Dates",
            description: "The dates for the State Bank's next meeting for monetary policy.",
            href: "https://www.sbp.org.pk/m_policy/mp-calendar.asp",
            category: "Economy",
            official: true,
          },
          {
            title: "SBP Economic Data",
            description: "Centralized data on inflation, FX reserves, interest rates, and more.",
            href: "https://www.sbp.org.pk/ecodata/index2.asp",
            category: "Economy",
            official: true,
          },
          {
            title: "Pakistan Investment Bonds Rates",
            description: "Daily PIB rates useful in determining interest rate direction.",
            href: "https://www.mufap.com.pk/WebRegulations/Index?Head=Pricing&title=PKRV/PKISRV/PKFRV",
            category: "Economy",
            official: true,
          },
          {
            title: "PBS Inflation",
            description: "Monthly CPI/WPI reports and weekly SPI data.",
            href: "https://www.pbs.gov.pk/",
            category: "Economy",
            official: true,
          },
          {
            title: "Finance Ministry Economic Updates",
            description: "Pakistan Economic Survey and monthly economic updates.",
            href: "https://www.finance.gov.pk/survey_2023.html",
            category: "Economy",
            official: true,
          },
          {
            title: "Pakistan Trade Statistics",
            description: "Trade statistics including imports and exports.",
            href: "https://www.pbs.gov.pk/trade-tables",
            category: "Economy",
            official: true,
          },
        ],
      },
      {
        title: "Auto Sector",
        description: "Production, sales, prices and public response signals for local auto companies.",
        links: [
          {
            title: "Monthly Production & Sales Data",
            description: "Month-wise production and sales data of automotive assemblers in Pakistan.",
            href: "https://pama.org.pk/monthly-production-sales-of-vehicles/",
            category: "Auto",
            official: true,
          },
          {
            title: "Annual Production & Sales Data",
            description: "Historic annual production and sales data of automotive assemblers in Pakistan.",
            href: "https://pama.org.pk/annual-sales-production/",
            category: "Auto",
            official: true,
          },
          {
            title: "Pakwheels",
            description: "Car reviews, prices, and public response to new launches.",
            href: "https://www.pakwheels.com/",
            category: "Auto",
          },
        ],
      },
      {
        title: "Textile Sector",
        description: "Industry association updates for the textile chain.",
        links: [
          {
            title: "APTMA Press Releases",
            description: "Official APTMA press releases and textile sector updates.",
            href: "https://aptma.org.pk/press-releases/",
            category: "Textile",
            official: true,
          },
        ],
      },
      {
        title: "Cement Sector",
        description: "Cement dispatch and coal input cost resources.",
        links: [
          {
            title: "APCMA",
            description: "All Pakistan Cement Manufacturers Association.",
            href: "https://www.apcma.com/",
            category: "Cement",
            official: true,
          },
          {
            title: "International Coal Prices",
            description: "International coal price data for cement input-cost tracking.",
            href: "https://tradingeconomics.com/commodity/coal",
            category: "Cement",
          },
        ],
      },
      {
        title: "Power Sector",
        description: "Tariff determinations and power-sector regulatory material.",
        links: [
          {
            title: "NEPRA Tariff Determinations",
            description: "NEPRA power tariff details.",
            href: "https://nepra.org.pk/tariff/",
            category: "Power",
            official: true,
          },
        ],
      },
      {
        title: "Fertilizer Sector",
        description: "Bag prices and industry statistics for fertilizer companies.",
        links: [
          {
            title: "Fertilizer Bag Prices",
            description: "Open the SPI annexure to check fertilizer bag prices in Pakistan.",
            href: "https://www.pbs.gov.pk/spi",
            category: "Fertilizer",
            official: true,
          },
          {
            title: "Fertilizer Statistics Pakistan",
            description: "Fertilizer industry statistics.",
            href: "http://www.nfdc.gov.pk/",
            category: "Fertilizer",
            official: true,
          },
        ],
      },
      {
        title: "Pharmaceutical Sector",
        description: "Essential medicine lists, market research and sector reports.",
        links: [
          {
            title: "Essential Medicines List (DRAP)",
            description: "National essential medicine lists from DRAP.",
            href: "https://www.dra.gov.pk/publications/national-essential-medicine-lists/",
            category: "Pharma",
            official: true,
          },
          {
            title: "IQVIA Reports on Pakistan",
            description: "IQVIA insights into Pakistan's pharma sector.",
            href: "https://www.iqvia.com/insights/points-of-view#q=pakistan",
            category: "Pharma",
          },
          {
            title: "ICAP Report on Pharmaceutical Sector",
            description: "ICAP yearly report on the pharmaceutical sector.",
            href: "https://www.icap.org.pk/paib/pdf/guidelines/PharmaIndustry2ndEdition.pdf",
            category: "Pharma",
          },
          {
            title: "VIS Ratings Report on Pharma",
            description: "VIS Ratings annual report on the pharmaceutical sector.",
            href: "https://docs.vis.com.pk/docs/PakistanPharmaceuticalSectorReport-Oct-2023.pdf",
            category: "Pharma",
          },
          {
            title: "PACRA Research on Pharma",
            description: "PACRA research report on the pharmaceutical sector.",
            href: "https://www.pacra.com/view/storage/app/Pharmaceuticals%20-%20PACRA%20Research%20-%20May%2724_1716980550.pdf",
            category: "Pharma",
          },
        ],
      },
      {
        title: "Rating Agencies",
        description: "Sector research and ratings from Pakistan's major rating agencies.",
        links: [
          {
            title: "PACRA Research",
            description: "Research material on different sectors of Pakistan's economy.",
            href: "https://www.pacra.com/research",
            category: "Ratings",
          },
          {
            title: "PACRA Ratings",
            description: "Latest rating reports of public and non-public companies.",
            href: "https://www.pacra.com/rating_resources_new",
            category: "Ratings",
          },
          {
            title: "VIS Research",
            description: "Research material on different sectors of Pakistan's economy.",
            href: "https://vis.com.pk/kc-sect.aspx",
            category: "Ratings",
          },
          {
            title: "VIS Ratings",
            description: "Latest rating reports of public and non-public companies.",
            href: "https://vis.com.pk/RatingSect.aspx",
            category: "Ratings",
          },
        ],
      },
    ],
  };
}

export async function getBoardMeetingsData(): Promise<BoardMeetingsData> {
  const cached = await getStaleCached({
    key: "explore:board-meetings:v3",
    ttlSeconds: DAILY_TTL_SECONDS,
    staleSeconds: DAILY_STALE_SECONDS,
    load: loadBoardMeetingsData,
    isUsable: (data) => data.rows.length > 0,
  });
  return cached.value;
}

export async function getBookClosuresData(): Promise<BookClosuresData> {
  const cached = await getStaleCached({
    key: "explore:book-closures:v2",
    ttlSeconds: DAILY_TTL_SECONDS,
    staleSeconds: DAILY_STALE_SECONDS,
    load: loadBookClosuresData,
    isUsable: (data) => data.rows.length > 0,
  });
  return cached.value;
}

export async function getDividendHistoryData(): Promise<DividendHistoryData> {
  const cached = await getStaleCached({
    key: "explore:dividend-history:v1",
    ttlSeconds: DAILY_TTL_SECONDS,
    staleSeconds: DAILY_STALE_SECONDS,
    load: loadDividendHistoryData,
    isUsable: (data) => data.rows.length > 0,
  });
  return cached.value;
}

export async function getPivotPointsData(): Promise<PivotPointsData> {
  const ttlSeconds = shouldRefreshPsxData() ? 60 : psxLiveCacheTtlSeconds();
  const cached = await getStaleCached({
    key: "analysis:pivot-points:v1",
    ttlSeconds,
    staleSeconds: psxClosedMaxStaleSeconds(),
    load: loadPivotPointsData,
    isUsable: (data) => data.rows.length > 0,
  });
  return cached.value;
}

async function loadBoardMeetingsData(): Promise<BoardMeetingsData> {
  const [primaryRows, fallbackHtml] = await Promise.all([
    tryLoadSscBoardMeetings(),
    tryFetchSource(SOURCES.boardMeetingsFallback),
  ]);

  if (primaryRows.length > 0) {
    return {
      rows: primaryRows,
      updatedAt: new Date().toISOString(),
      sourceUrl: SOURCES.boardMeetingsPrimary,
      sourceLabel: "SCS Trade",
    };
  }

  const rows = fallbackHtml ? parseBoardMeetingsTables(fallbackHtml, "KSE Stocks") : [];
  return {
    rows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.boardMeetingsFallback,
    sourceLabel: "KSE Stocks",
  };
}

async function tryLoadSscBoardMeetings(): Promise<BoardMeetingRow[]> {
  try {
    const payload = await fetchJson<{ d?: SscBoardMeetingRaw[] }>(
      `${SOURCES.boardMeetingsPrimary}/chartact`,
      {
        _search: false,
        nd: Date.now(),
        rows: 500,
        page: 1,
        sidx: "bm_date",
        sord: "asc",
        par: "",
      }
    );
    return (payload.d ?? [])
      .map((row) => {
        const symbol = clean(row.company_code).toUpperCase();
        const company = clean(row.company_name) || symbol;
        const meetingDate = normalizeMicrosoftJsonDate(row.bm_date);
        if (!company || !meetingDate) return null;
        const period = [clean(row.bm_quarter_number), clean(row.bm_year)].filter(Boolean).join(" ");
        const place = clean(row.bm_place);
        return {
          id: makeId("SCS Trade", symbol, meetingDate, row.bm_time, period),
          symbol: symbol || null,
          company,
          meetingDate,
          meetingTime: clean(row.bm_time) || "—",
          subject: period
            ? `Board meeting · ${period}`
            : place
              ? `Board meeting · ${place}`
              : "Board meeting",
          sourceLabel: "SCS Trade",
        } satisfies BoardMeetingRow;
      })
      .filter((row): row is BoardMeetingRow => Boolean(row));
  } catch (error) {
    console.warn("[resources] SCS board meetings failed:", error);
    return [];
  }
}

async function loadBookClosuresData(): Promise<BookClosuresData> {
  const [primaryRows, fallbackHtml] = await Promise.all([
    tryLoadSscBookClosures(),
    tryFetchSource(SOURCES.bookClosuresFallback),
  ]);

  if (primaryRows.length > 0) {
    return {
      rows: primaryRows,
      updatedAt: new Date().toISOString(),
      sourceUrl: SOURCES.bookClosuresPrimary,
      sourceLabel: "SCS Trade",
    };
  }

  const rows = fallbackHtml ? parseKseBookClosures(fallbackHtml) : [];
  return {
    rows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.bookClosuresFallback,
    sourceLabel: "KSE Stocks",
  };
}

async function loadDividendHistoryData(): Promise<DividendHistoryData> {
  const [primaryHtml, fallbackHtml] = await Promise.all([
    tryFetchSource(SOURCES.dividendPrimary),
    tryFetchSource(SOURCES.dividendFallback),
  ]);

  const primaryRows = primaryHtml ? parseDividendTables(primaryHtml, "PSX") : [];
  if (primaryRows.length > 0) {
    return {
      rows: primaryRows,
      updatedAt: new Date().toISOString(),
      sourceUrl: SOURCES.dividendPrimary,
      sourceLabel: "PSX",
    };
  }

  const rows = fallbackHtml ? parseDividendTables(fallbackHtml, "KSE Stocks") : [];
  return {
    rows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.dividendFallback,
    sourceLabel: "KSE Stocks",
  };
}

async function loadPivotPointsData(): Promise<PivotPointsData> {
  const rows = await getMarketRows();
  const pivotRows = rows
    .map((row): PivotPointRow | null => {
      const high = numberOrNull(row.high);
      const low = numberOrNull(row.low);
      const previousClose = numberOrNull(row.ldcp);
      if (high == null || low == null || previousClose == null || high <= 0 || low <= 0) {
        return null;
      }
      const pivot = (high + low + previousClose) / 3;
      const range = high - low;
      const seed = getSeedTicker(row.symbol);
      return {
        symbol: row.symbol,
        companyName: seed?.company ?? row.symbol,
        sector: row.sector ?? seed?.sector ?? "Other",
        current: row.current,
        high,
        low,
        previousClose,
        pivot,
        r1: 2 * pivot - low,
        s1: 2 * pivot - high,
        r2: pivot + range,
        s2: pivot - range,
        r3: high + 2 * (pivot - low),
        s3: low - 2 * (high - pivot),
        range,
        capturedAt: row.capturedAt ?? null,
      };
    })
    .filter((row): row is PivotPointRow => Boolean(row))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    rows: pivotRows,
    updatedAt: new Date().toISOString(),
    sourceUrl: SOURCES.pivotReference,
    sourceLabel: "Stockli calculation",
    method: "Classic floor pivots from latest session high, low and previous close.",
  };
}

async function fetchSource(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json() as Promise<T>;
}

async function tryFetchSource(url: string): Promise<string | null> {
  try {
    return await fetchSource(url);
  } catch (error) {
    console.warn(`[resources] fetch failed for ${url}:`, error);
    return null;
  }
}

function parseBoardMeetingsTables(html: string, sourceLabel: string): BoardMeetingRow[] {
  const tables = parseHtmlTables(html);
  const rows: BoardMeetingRow[] = [];
  for (const table of tables) {
    const header = table[0]?.map(normalizeHeader) ?? [];
    if (!header.includes("company") || !header.includes("date")) continue;
    const dateIndex = findHeaderIndex(header, ["date", "meetingdate"]);
    const timeIndex = findHeaderIndex(header, ["time", "meetingtime"]);
    const companyIndex = findHeaderIndex(header, ["company", "companyname"]);
    const subjectIndex = findHeaderIndex(header, ["subject", "agenda", "purpose"]);
    if (dateIndex < 0 || companyIndex < 0) continue;

    for (const cells of table.slice(1)) {
      const company = clean(cells[companyIndex]);
      const meetingDate = normalizeLooseDate(cells[dateIndex]);
      if (!company || !meetingDate) continue;
      const meetingTime = clean(cells[timeIndex]) || "—";
      const subject = clean(cells[subjectIndex]) || "Board meeting";
      rows.push({
        id: makeId(sourceLabel, company, meetingDate, meetingTime, subject),
        symbol: extractSymbol(company),
        company,
        meetingDate,
        meetingTime,
        subject,
        sourceLabel,
      });
    }
  }
  return rows;
}

async function tryLoadSscBookClosures(): Promise<BookClosureRow[]> {
  try {
    const payload = await fetchJson<{ d?: SscBookClosureRaw[] }>(
      `${SOURCES.bookClosuresPrimary}/chartact`,
      {
        _search: false,
        nd: Date.now(),
        rows: 300,
        page: 1,
        sidx: "bm_bc_exp",
        sord: "asc",
        par: "",
      }
    );
    return (payload.d ?? [])
      .map((row) => {
        const payout = [
          clean(row.bm_dividend) ? `Dividend ${clean(row.bm_dividend)}` : "",
          clean(row.bm_bonus) ? `Bonus ${clean(row.bm_bonus)}` : "",
          clean(row.bm_right_per) ? `Right ${clean(row.bm_right_per)}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        if (!hasPayout(payout)) return null;
        const symbol = clean(row.company_code).toUpperCase();
        if (!symbol) return null;
        const xDate = normalizeLooseDate(row.bm_bc_exp);
        return {
          id: makeId("SCS Trade", symbol, xDate, payout),
          symbol,
          company: clean(row.company_name) || symbol,
          faceValue: "—",
          bookClosureFrom: xDate || "—",
          bookClosureTo: xDate || "—",
          payout,
          lastClose: "—",
          sourceLabel: "SCS Trade",
        } satisfies BookClosureRow;
      })
      .filter((row): row is BookClosureRow => Boolean(row));
  } catch (error) {
    console.warn("[resources] SCS book closures failed:", error);
    return [];
  }
}

function parseKseBookClosures(html: string): BookClosureRow[] {
  const match = html.match(/var\s+bcs\s*=\s*(\{[\s\S]*?\});\s*\$\(function/);
  if (!match) return [];
  let payload: KseBookClosuresPayload;
  try {
    payload = JSON.parse(match[1]) as KseBookClosuresPayload;
  } catch {
    return [];
  }
  const rawRows = [...(payload.cur ?? []), ...(payload.old ?? [])];
  return rawRows
    .filter((row) => hasPayout(row.payout))
    .map((row) => ({
      id: makeId("KSE Stocks", row.symbol, row.bcfrom, row.bcto, row.payout),
      symbol: clean(row.symbol).toUpperCase(),
      company: clean(row.cname) || clean(row.symbol).toUpperCase(),
      faceValue: clean(row.faceval) || "—",
      bookClosureFrom: normalizeLooseDate(row.bcfrom),
      bookClosureTo: normalizeLooseDate(row.bcto),
      payout: clean(row.payout),
      lastClose: clean(row.lc) || "—",
      sourceLabel: "KSE Stocks",
    }));
}

function parseDividendTables(html: string, sourceLabel: string): DividendHistoryRow[] {
  const tables = parseHtmlTables(html);
  const rows: DividendHistoryRow[] = [];
  for (const table of tables) {
    const header = table[0]?.map(normalizeHeader) ?? [];
    const symbolIndex = findHeaderIndex(header, ["symbol", "code"]);
    const payoutIndex = findHeaderIndex(header, ["payout", "dividend"]);
    const creditedIndex = findHeaderIndex(header, ["creditedon", "credited", "paymentdate", "date"]);
    if (symbolIndex < 0 || payoutIndex < 0) continue;

    for (const cells of table.slice(1)) {
      const symbol = clean(cells[symbolIndex]).toUpperCase();
      const payout = clean(cells[payoutIndex]);
      if (!symbol || !hasPayout(payout)) continue;
      rows.push({
        id: makeId(sourceLabel, symbol, payout, cells[creditedIndex]),
        symbol,
        payout,
        creditedOn: normalizeLooseDate(cells[creditedIndex]) || "—",
        sourceLabel,
      });
    }
  }
  return rows;
}

function parseHtmlTables(html: string): string[][][] {
  const root = parse(html);
  return root.querySelectorAll("table").map((table) =>
    table.querySelectorAll("tr").map((row) =>
      row.querySelectorAll("th, td").map((cell) => clean(cell.textContent))
    )
  );
}

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  return headers.findIndex((header) =>
    candidates.some((candidate) => header === candidate || header.includes(candidate))
  );
}

function normalizeLooseDate(value: unknown): string {
  const text = clean(value);
  if (!text || text === "—") return "";
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const compact = text.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,}|\d{1,2})[-/ ](\d{2,4})$/);
  if (!compact) return text;
  const day = compact[1].padStart(2, "0");
  const month = monthNumber(compact[2]);
  const rawYear = Number(compact[3]);
  const year = rawYear < 100 ? (rawYear < 50 ? 2000 + rawYear : 1900 + rawYear) : rawYear;
  return month ? `${year}-${month}-${day}` : text;
}

function normalizeMicrosoftJsonDate(value: unknown): string {
  const text = clean(value);
  const match = text.match(/\/Date\((-?\d+)\)\//);
  if (!match) return normalizeLooseDate(text);
  const date = new Date(Number(match[1]));
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PSX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function monthNumber(value: string): string | null {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return String(numeric).padStart(2, "0");
  }
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(value.slice(0, 3).toLowerCase());
  return index >= 0 ? String(index + 1).padStart(2, "0") : null;
}

function hasPayout(value: unknown): boolean {
  const text = clean(value);
  if (!text || /^nil$/i.test(text) || /^n\/a$/i.test(text) || text === "-") return false;
  return /dividend|bonus|right|cash|interim|final|%|rs\.?/i.test(text);
}

function extractSymbol(company: string): string | null {
  const match = company.match(/\(([A-Z0-9.-]{2,12})\)/);
  return match ? match[1] : null;
}

function makeId(...parts: unknown[]): string {
  return parts.map((part) => clean(part).toLowerCase().replace(/[^a-z0-9]+/g, "-")).join(":");
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
