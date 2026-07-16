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
/** How many trailing trading days to scrape live per refresh. NCCPL's Cloudflare
 * flags rapid-fire automated requests, and each day takes ~15-30s of real
 * browser automation, so we only re-scrape a small recent window and let
 * older days stay sample-filled (or previously-scraped, once cached). */
const LIVE_SCRAPE_DAYS = 5;
const USD_PKR_FALLBACK = 278.5;

export async function getFipiLipiData(): Promise<FipiLipiData> {
  const { value } = await getStaleCached({
    key: "market:fipi-lipi-v3",
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

  const days = dates.map((date) => liveByDate.get(date) ?? buildSampleDay(date));

  const liveCount = liveByDate.size;
  const source: FipiLipiData["source"] =
    liveCount === 0 ? "sample" : liveCount === dates.length ? "nccpl" : "mixed";

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
 * Live NCCPL fetch for the Regular market, via a small standalone scraper
 * service (scraper/) that drives a real stealth browser to solve NCCPL's
 * Cloudflare challenge and replay its tab-click -> date -> search flow.
 * See scraper/README.md for what it does and how to deploy it.
 *
 * Set NCCPL_SCRAPER_URL (and NCCPL_SCRAPER_API_KEY if the service requires
 * one) to switch on live data; until then the caller falls back to sample
 * figures and the UI labels itself accordingly.
 */
async function scrapeNccplRegular(dates: string[]): Promise<FipiLipiDay[] | null> {
  const baseUrl = process.env.NCCPL_SCRAPER_URL;
  if (!baseUrl || dates.length === 0) return null;

  const apiKey = process.env.NCCPL_SCRAPER_API_KEY;
  const days: FipiLipiDay[] = [];

  for (const date of dates) {
    const url = new URL("/fipi-lipi", baseUrl);
    url.searchParams.set("date", date);

    const res = await fetch(url, {
      headers: apiKey ? { "X-API-Key": apiKey } : undefined,
      // Real browser automation on the other end; give it room to work.
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.warn(`[fipi-lipi] scraper returned ${res.status} for ${date}, skipping day`);
      continue;
    }

    const day = (await res.json()) as FipiLipiDay;
    days.push(day);
  }

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
