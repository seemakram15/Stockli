import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { isTradingDay, psxLocalDateString } from "@/lib/psx/market-hours";
import {
  FIPI_CATEGORIES,
  FLOW_SECTORS,
  LIPI_CATEGORIES,
  type CategoryRow,
  type FipiLipiData,
  type FipiLipiDay,
} from "@/lib/types/fipi-lipi";

export {
  FIPI_CATEGORIES,
  FLOW_SECTORS,
  LIPI_CATEGORIES,
  type CategoryRow,
  type FipiLipiData,
  type FipiLipiDay,
};

/**
 * FIPI / LIPI — Foreign & Local Investor Portfolio Investment (Regular market).
 *
 * NCCPL publishes this every trading day around 18:00–19:00 PKT, in US$ millions.
 * Figures here are ABSOLUTE USD so the UI can scale them and convert with `usdPkrRate`.
 *
 * Market-clearing identity: FIPI net === −LIPI net, and each row's sector nets
 * sum to that row's net.
 */

const FIPI_TTL_SECONDS = 30 * 60;
const FIPI_STALE_SECONDS = 24 * 60 * 60;
const HISTORY_DAYS = 180;
/** How many trailing trading days to scrape live per refresh. Cheap plain
 * JSON POSTs (no browser), so this can go much higher than a scraped-site
 * budget — 60 trading days is just courtesy, not a hard technical limit. */
const LIVE_SCRAPE_DAYS = 60;
const USD_PKR_FALLBACK = 278.5;

export async function getFipiLipiData(): Promise<FipiLipiData> {
  const { value } = await getStaleCached({
    key: "market:fipi-lipi-v7",
    ttlSeconds: FIPI_TTL_SECONDS,
    staleSeconds: FIPI_STALE_SECONDS,
    load: loadFipiLipiData,
    isUsable: (data) => data.days.length > 0,
  });
  return value;
}

async function loadFipiLipiData(): Promise<FipiLipiData> {
  const dates = recentTradingDates(HISTORY_DAYS);
  const liveDates = dates.slice(-LIVE_SCRAPE_DAYS);

  const liveDays = await scrapeNccplRegular(liveDates).catch((err) => {
    console.warn("[fipi-lipi] NCCPL scraper unavailable, falling back to sample data:", err);
    return null;
  });
  const liveByDate = new Map((liveDays ?? []).map((d) => [d.date, d]));

  // Trim trailing dates that were attempted live but came back with nothing
  // published yet (e.g. today, before close) — drop them rather than
  // sample-filling the most recent day with a fake number. Older gaps (not
  // at the very end) still get sample-filled so history stays contiguous.
  let trimmedDates = dates;
  while (
    trimmedDates.length > 0 &&
    liveDates.includes(trimmedDates[trimmedDates.length - 1]) &&
    !liveByDate.has(trimmedDates[trimmedDates.length - 1])
  ) {
    trimmedDates = trimmedDates.slice(0, -1);
  }

  const days = trimmedDates.map((date) => liveByDate.get(date) ?? buildSampleDay(date));

  const liveCount = liveByDate.size;
  const source: FipiLipiData["source"] =
    liveCount === 0 ? "sample" : liveCount === trimmedDates.length ? "nccpl" : "mixed";

  applyCumulatives(days);

  const latest = days.at(-1) ?? null;
  const refDate = latest?.date ?? psxLocalDateString();
  const year = Number(refDate.slice(0, 4));
  const month = Number(refDate.slice(5, 7));
  // Pakistan FY runs Jul→Jun, and is named for the year it ends in.
  const fyEndYear = month >= 7 ? year + 1 : year;

  return {
    days,
    dates: days.map((d) => d.date),
    latest,
    usdPkrRate: USD_PKR_FALLBACK,
    fyLabel: `FY${String(fyEndYear).slice(2)}TD`,
    cyLabel: `CY${String(year).slice(2)}TD`,
    updatedAt: new Date().toISOString(),
    source,
  };
}

/**
 * Live FIPI/LIPI fetch, sourced from Standard Capital Securities' public
 * market-information page (scstrade.com/FIPILIPI.aspx), which republishes
 * NCCPL's data through its own plain JSON endpoints — no Cloudflare, no
 * CSRF token, no browser automation required (unlike NCCPL's own site).
 *
 * Endpoints (verified against the live site, 2026-07):
 *   POST /FIPILIPI.aspx/loadmainsumdetails  {date1, date2}  -> per-category buy/sell/net
 *   POST /FIPILIPI.aspx/loadfipisector      {date1, date2}  -> per-(sector, category) buy/sell/net
 * date1/date2 are the same single date in MM/DD/YYYY format (the site uses
 * them as a from/to range; passing the same date both times gets one day).
 */
const SCS_BASE_URL = "https://scstrade.com/FIPILIPI.aspx";

interface ScsCategoryRow {
  FLType: string;
  FLBuyValue: number;
  FLSellValue: number;
  FLNetValueUSD: number;
}

interface ScsSectorRow {
  FLSectorName: string;
  FLTypeNew: string;
  FLBuyValue: number;
  FLSellValue: number;
  FLNetValueUSD: number;
}

// scstrade.com's real CLIENT_TYPE strings vary slightly from NCCPL's, so map
// by keyword rather than exact string. FIPI classification requires a
// FOREIGN/OVERSEAS prefix specifically — a bare "INDIVIDUAL" needle would
// also match LIPI's "INDIVIDUALS" and misfile it as foreign flow.
const FIPI_KEYWORDS: [string, string][] = [
  ["OVERSEAS", "Overseas Pakistani"],
  ["FOREIGN CORPORATE", "Foreign Corporate"],
  ["FOREIGN INDIVIDUAL", "Foreign Individual"],
];
const LIPI_KEYWORDS: [string, string][] = [
  ["INDIVIDUAL", "Individuals"],
  ["COMPAN", "Companies"],
  ["BANK", "Banks / DFI"],
  ["DFI", "Banks / DFI"],
  ["NBFC", "NBFC"],
  ["MUTUAL", "Mutual Funds"],
  ["BROKER", "Brokers"],
  ["INSURANCE", "Insurance"],
  ["OTHER", "Other"],
];
const SECTOR_KEYWORDS: [string, string][] = [
  ["COMMERCIAL BANK", "Banks"],
  ["OIL AND GAS MARKETING", "OMCs"],
  ["OIL AND GAS EXPLORATION", "E&Ps"],
  ["EXPLORATION", "E&Ps"],
  ["CEMENT", "Cement"],
  ["FERTILIZER", "Fertilizer"],
  ["FOOD", "FMCGs"],
  ["PERSONAL CARE", "FMCGs"],
  ["POWER GENERATION", "IPPs"],
  ["TECHNOLOGY", "Telecom"],
  ["COMMUNICATION", "Telecom"],
  ["TEXTILE", "Textile"],
  ["DEBT MARKET", "Debt Mkt."],
];

function matchKeyword(value: string, table: [string, string][], fallback: string): string {
  const upper = value.trim().toUpperCase();
  for (const [needle, bucket] of table) {
    if (upper.includes(needle)) return bucket;
  }
  return fallback;
}

function emptyCategoryRow(label: string): CategoryRow {
  return { label, buy: 0, sell: 0, net: 0, sectors: FLOW_SECTORS.map(() => 0), fytd: 0, cytd: 0 };
}

async function scsPost<T>(endpoint: string, dateMDY: string): Promise<T[] | null> {
  const res = await fetch(`${SCS_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({ date1: dateMDY, date2: dateMDY }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.warn(`[fipi-lipi] scstrade ${endpoint} returned ${res.status} for ${dateMDY}`);
    return null;
  }
  const json = (await res.json()) as { d?: T[] };
  return json.d ?? null;
}

async function scrapeOneDay(date: string): Promise<FipiLipiDay | null> {
  const [year, month, day] = date.split("-");
  const dateMDY = `${month}/${day}/${year}`;

  const [categoryRows, sectorRows] = await Promise.all([
    scsPost<ScsCategoryRow>("loadmainsumdetails", dateMDY),
    scsPost<ScsSectorRow>("loadfipisector", dateMDY),
  ]);
  // An empty array (not null) means the endpoint responded fine but has
  // nothing for this date yet — e.g. today, before NCCPL/SCS publish the
  // day's close. Treat that the same as "no data" rather than a real
  // all-zero trading day.
  if (!categoryRows || categoryRows.length === 0) return null;

  const fipiRows = new Map<string, CategoryRow>(FIPI_CATEGORIES.map((label) => [label, emptyCategoryRow(label)]));
  const lipiRows = new Map<string, CategoryRow>(LIPI_CATEGORIES.map((label) => [label, emptyCategoryRow(label)]));

  for (const rec of categoryRows) {
    const fipiLabel = matchKeyword(rec.FLType, FIPI_KEYWORDS, "");
    const target = fipiLabel ? fipiRows : lipiRows;
    const label = fipiLabel || matchKeyword(rec.FLType, LIPI_KEYWORDS, "Other");
    const row = target.get(label) ?? emptyCategoryRow(label);
    row.buy += rec.FLBuyValue * 1_000_000;
    row.sell += Math.abs(rec.FLSellValue) * 1_000_000;
    row.net += rec.FLNetValueUSD * 1_000_000;
    target.set(label, row);
  }

  // Sector data isn't split per FIPI sub-category (Corporate/Individual/Overseas) —
  // only a combined "FIPI" row — so it lands on the FIPI total, not the sub-rows.
  const sectorNames: string[] = [...FLOW_SECTORS];
  const fipiSectorTotals = FLOW_SECTORS.map(() => 0);
  for (const rec of sectorRows ?? []) {
    const sectorIdx = sectorNames.indexOf(matchKeyword(rec.FLSectorName, SECTOR_KEYWORDS, "Others"));
    const idx = sectorIdx === -1 ? sectorNames.indexOf("Others") : sectorIdx;
    if (rec.FLTypeNew.trim().toUpperCase() === "FIPI") {
      fipiSectorTotals[idx] += rec.FLNetValueUSD * 1_000_000;
      continue;
    }
    const label = matchKeyword(rec.FLTypeNew, LIPI_KEYWORDS, "Other");
    const row = lipiRows.get(label);
    if (row) row.sectors[idx] += rec.FLNetValueUSD * 1_000_000;
  }

  const fipiList = FIPI_CATEGORIES.map((label) => fipiRows.get(label)!);
  const lipiList = LIPI_CATEGORIES.map((label) => lipiRows.get(label)!);

  const fipiNet = totalRow("Net", fipiList);
  fipiNet.sectors = fipiSectorTotals;
  const lipiNet = totalRow("Net", lipiList);

  return { date, fipi: fipiList, fipiNet, lipi: lipiList, lipiNet };
}

async function scrapeNccplRegular(dates: string[]): Promise<FipiLipiDay[] | null> {
  const results = await Promise.all(
    dates.map((date) =>
      scrapeOneDay(date).catch((err) => {
        console.warn(`[fipi-lipi] scstrade.com fetch failed for ${date}:`, err);
        return null;
      })
    )
  );
  const days = results.filter((d): d is FipiLipiDay => d != null);
  return days.length > 0 ? days : null;
}

/** Walk the series once and stamp each row's running FY / CY cumulative net. */
function applyCumulatives(days: FipiLipiDay[]): void {
  const fyTotals = new Map<string, number>();
  const cyTotals = new Map<string, number>();
  let fyKey = "";
  let cyKey = "";

  for (const day of days) {
    const year = Number(day.date.slice(0, 4));
    const month = Number(day.date.slice(5, 7));
    const nextFy = month >= 7 ? `${year + 1}` : `${year}`;
    const nextCy = `${year}`;
    if (nextFy !== fyKey) {
      fyKey = nextFy;
      fyTotals.clear();
    }
    if (nextCy !== cyKey) {
      cyKey = nextCy;
      cyTotals.clear();
    }

    for (const [key, row] of keyedRows(day)) {
      const fy = (fyTotals.get(key) ?? 0) + row.net;
      const cy = (cyTotals.get(key) ?? 0) + row.net;
      fyTotals.set(key, fy);
      cyTotals.set(key, cy);
      row.fytd = fy;
      row.cytd = cy;
    }
  }
}

/** Both groups have a row labelled "Net", so keys are group-scoped to keep them apart. */
function keyedRows(day: FipiLipiDay): [string, CategoryRow][] {
  return [
    ...day.fipi.map((r) => [`fipi:${r.label}`, r] as [string, CategoryRow]),
    ["fipi:__total", day.fipiNet],
    ...day.lipi.map((r) => [`lipi:${r.label}`, r] as [string, CategoryRow]),
    ["lipi:__total", day.lipiNet],
  ];
}

function recentTradingDates(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    if (!isTradingDay(d)) continue;
    out.push(psxLocalDateString(d));
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Sample data — deterministic per date, shaped like a real NCCPL Regular-market
 * day so the screen is fully usable before the live scrape is wired.
 * ------------------------------------------------------------------------- */

function buildSampleDay(date: string): FipiLipiDay {
  const rand = mulberry32(hashString(date));

  // Foreigners are structurally light net sellers on PSX — bias slightly negative.
  const foreignNet = (rand() - 0.58) * 9_000_000;
  const foreignGross = 4_000_000 + rand() * 14_000_000;
  const localGross = foreignGross * (9 + rand() * 6);

  const fipi = buildRows(FIPI_CATEGORIES, foreignNet, foreignGross, [0.72, 0.04, 0.24], rand);
  const lipi = buildRows(
    LIPI_CATEGORIES,
    -foreignNet, // market clears
    localGross,
    [0.34, 0.16, 0.12, 0.02, 0.18, 0.04, 0.1, 0.04],
    rand
  );

  return {
    date,
    fipi,
    fipiNet: totalRow("Net", fipi),
    lipi,
    lipiNet: totalRow("Net", lipi),
  };
}

function buildRows(
  labels: readonly string[],
  totalNet: number,
  totalGross: number,
  weights: number[],
  rand: () => number
): CategoryRow[] {
  const jittered = weights.map((w) => Math.max(0.01, w * (0.6 + rand() * 0.8)));
  const sum = jittered.reduce((a, b) => a + b, 0);
  const shares = jittered.map((w) => w / sum);

  // Net is signed and must reconcile, so wobble each row then push the residual
  // onto the largest slice.
  const nets = shares.map((s) => totalNet * s * (0.4 + rand() * 1.6));
  const residual = totalNet - nets.reduce((a, b) => a + b, 0);
  nets[shares.indexOf(Math.max(...shares))] += residual;

  return labels.map((label, i) => {
    const net = nets[i];
    const buy = totalGross * shares[i] + Math.max(0, net) / 2;
    return {
      label,
      buy,
      sell: buy - net,
      net,
      sectors: splitIntoSectors(net, rand),
      fytd: 0,
      cytd: 0,
    };
  });
}

function splitIntoSectors(net: number, rand: () => number): number[] {
  const raw = FLOW_SECTORS.map(() => rand() - 0.45);
  const scale = raw.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const nets = raw.map((r) => (r / scale) * Math.abs(net) * 1.6);
  nets[nets.length - 1] += net - nets.reduce((a, b) => a + b, 0);
  return nets;
}

function totalRow(label: string, rows: CategoryRow[]): CategoryRow {
  return {
    label,
    buy: rows.reduce((s, r) => s + r.buy, 0),
    sell: rows.reduce((s, r) => s + r.sell, 0),
    net: rows.reduce((s, r) => s + r.net, 0),
    sectors: FLOW_SECTORS.map((_, i) => rows.reduce((s, r) => s + r.sectors[i], 0)),
    fytd: 0,
    cytd: 0,
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
