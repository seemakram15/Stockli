import { type NextRequest, NextResponse } from "next/server";
import { getStaleCached } from "@/lib/cache/stale";
import { getPakistanCommodities } from "@/lib/services/pakistan-commodities";
import { getPakistanRawMaterials } from "@/lib/services/pakistan-raw-materials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface HistoryPoint {
  date: string;
  price: number;
}

const YAHOO_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const HEADERS = {
  accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; Stockli/1.0; +https://mystockli.qzz.io)",
};
const TOLAS_PER_OZ = 2.66667;
const LBS_PER_KG = 2.20462;

async function fetchYahooHistory(symbol: string, range: string, interval: string): Promise<HistoryPoint[]> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${symbol}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];
  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const price = closes[i];
    if (price == null || !Number.isFinite(price)) continue;
    points.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), price: Math.round(price * 100) / 100 });
  }
  return points;
}

async function fetchMerged(symbol: string): Promise<HistoryPoint[]> {
  const [daily, allTime] = await Promise.all([
    fetchYahooHistory(symbol, "1y", "1d"),
    fetchYahooHistory(symbol, "max", "1wk"),
  ]);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  const historic = allTime.filter((p) => p.date < cutoff);
  const seen = new Set<string>();
  const merged = [...historic, ...daily].sort((a, b) => a.date.localeCompare(b.date));
  return merged.filter((p) => { if (seen.has(p.date)) return false; seen.add(p.date); return true; });
}

function buildMergedMap(dailyPts: HistoryPoint[], weeklyPts: HistoryPoint[]): Map<string, number> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  const historic = weeklyPts.filter((p) => p.date < cutoff);
  const seen = new Set<string>();
  const merged = [...historic, ...dailyPts].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map<string, number>();
  for (const p of merged) {
    if (!seen.has(p.date)) { seen.add(p.date); map.set(p.date, p.price); }
  }
  return map;
}

async function fetchPkPriceHistory(
  spotSymbol: string,
  convert: (spotPrice: number, pkrRate: number) => number,
  liveAnchor: number | null,
): Promise<HistoryPoint[]> {
  const [spotDaily, spotWeekly, pkrDaily, pkrWeekly] = await Promise.all([
    fetchYahooHistory(spotSymbol, "1y", "1d"),
    fetchYahooHistory(spotSymbol, "max", "1wk"),
    fetchYahooHistory("PKR=X", "1y", "1d"),
    fetchYahooHistory("PKR=X", "max", "1wk"),
  ]);

  const spotMap = buildMergedMap(spotDaily, spotWeekly);
  const pkrMap = buildMergedMap(pkrDaily, pkrWeekly);

  const points: HistoryPoint[] = [];
  for (const [date, spotPrice] of spotMap) {
    const pkrRate = pkrMap.get(date);
    if (!pkrRate) continue;
    points.push({ date, price: convert(spotPrice, pkrRate) });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));

  // Calibrate so the most-recent computed value matches the live pakgold price.
  // This corrects for the gap between Yahoo's interbank PKR rate and the open-market
  // rate used by Sarafa (typically 15-25% higher) without distorting historical shape.
  let scale = 1;
  if (liveAnchor && points.length > 0) {
    const lastComputed = points[points.length - 1].price;
    if (lastComputed > 0) scale = liveAnchor / lastComputed;
  }

  return points.map((p) => ({ date: p.date, price: Math.round(p.price * scale) }));
}

const SCRAPE_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MONTH_NAMES = ["january","february","march","april","may","june","july","august","september","october","november","december"];

async function fetchScrapeHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": SCRAPE_UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

function extractPrice(html: string, keyword: string, min: number, max: number): number | null {
  const idx = html.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return null;
  const chunk = html.slice(idx, idx + 2000);
  const re = /\b(\d{1,2},\d{3}(?:,\d{3})*|\d{2,7})\b/g;
  let m: RegExpExecArray | null;
  const nums: number[] = [];
  while ((m = re.exec(chunk)) !== null) {
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    if (n >= min && n <= max) nums.push(n);
  }
  if (nums.length === 0) return null;
  if (nums.length >= 2 && nums[1] - nums[0] <= nums[0] * 0.15) return Math.round((nums[0] + nums[1]) / 2);
  return nums[0];
}

function avgOrNull(...vals: (number | null)[]): number | null {
  const good = vals.filter((v): v is number => v !== null);
  if (good.length === 0) return null;
  return Math.round(good.reduce((a, b) => a + b, 0) / good.length);
}

async function fetchCementMonthlyHistory(): Promise<HistoryPoint[]> {
  const today = new Date();
  const targets = Array.from({ length: 18 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth(), dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01` };
  });

  const results = await Promise.all(
    targets.map(async ({ year, month, dateStr }) => {
      const mon = MONTH_NAMES[month];
      const urls = [
        `https://materialrate.pk/cement-rate-in-${mon}-${year}/`,
        `https://materialrate.pk/${mon}-${year}-cement-rate-in-pakistan/`,
        `https://materialrate.pk/cement-rate-${mon}-${year}/`,
      ];
      for (const url of urls) {
        const html = await fetchScrapeHtml(url);
        if (!html) continue;
        const price = avgOrNull(
          extractPrice(html, "Lucky", 1000, 2500),
          extractPrice(html, "Bestway", 1000, 2500),
          extractPrice(html, "DG Khan", 1000, 2500),
          extractPrice(html, "Fauji", 1000, 2500),
        );
        if (price) return { date: dateStr, price };
      }
      return null;
    })
  );

  const points = results.filter((r): r is HistoryPoint => r !== null);
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

const SYMBOL_LOADERS: Record<string, () => Promise<HistoryPoint[]>> = {
  "GC=F":             () => fetchMerged("GC=F"),
  "SI=F":             () => fetchMerged("SI=F"),
  "HG=F":             () => fetchMerged("HG=F"),
  "PL=F":             () => fetchMerged("PL=F"),
  "PA=F":             () => fetchMerged("PA=F"),
  "ZC=F":             () => fetchMerged("ZC=F"),
  "ZW=F":             () => fetchMerged("ZW=F"),
  "ZS=F":             () => fetchMerged("ZS=F"),
  "KC=F":             () => fetchMerged("KC=F"),
  "PK-GOLD-TOLA": async () => {
    const live = await getPakistanCommodities().catch(() => null);
    return fetchPkPriceHistory("GC=F", (s, r) => (s * r) / TOLAS_PER_OZ, live?.gold24?.pricePerTola ?? null);
  },
  "PK-SILVER-TOLA": async () => {
    const live = await getPakistanCommodities().catch(() => null);
    return fetchPkPriceHistory("SI=F", (s, r) => (s * r) / TOLAS_PER_OZ, live?.silver?.pricePerTola ?? null);
  },
  "PK-COPPER-KG": async () => {
    const live = await getPakistanCommodities().catch(() => null);
    return fetchPkPriceHistory("HG=F", (s, r) => s * LBS_PER_KG * r, live?.copper?.pricePerKg ?? null);
  },
  "PK-PLATINUM-TOLA": async () => {
    const live = await getPakistanCommodities().catch(() => null);
    return fetchPkPriceHistory("PL=F", (s, r) => (s * r) / TOLAS_PER_OZ, live?.platinum?.pricePerTola ?? null);
  },
  // MTF=F = Newcastle thermal coal futures (USD/MT on ICE via Yahoo Finance)
  "PK-COAL": async () => {
    const live = await getPakistanRawMaterials().catch(() => null);
    const anchor = live?.items.find(i => i.label === "Coal (Imported)")?.price ?? null;
    return fetchPkPriceHistory("MTF=F", (s, r) => s * r, anchor).catch(() => []);
  },
  // NU=F = CME Urea (Granular) Futures (USD/MT) — convert to PKR per 50kg bag
  "PK-UREA": async () => {
    const live = await getPakistanRawMaterials().catch(() => null);
    const anchor = live?.items.find(i => i.label === "Urea")?.price ?? null;
    return fetchPkPriceHistory("NU=F", (s, r) => s * r * 0.05, anchor).catch(
      () => fetchPkPriceHistory("CF", (s, r) => s * r * 0.08, anchor).catch(() => [])
    );
  },
  "PK-CEMENT-V3": async () => {
    // Strategy 1: globalpetrolprices.com embeds Google Charts data with Pakistan cement history
    const gpHtml = await fetchScrapeHtml("https://www.globalpetrolprices.com/Pakistan/cement_prices/").catch(() => null);
    if (gpHtml) {
      const pts: HistoryPoint[] = [];
      const re = /\["([A-Za-z]+),\s*(\d{4})",\s*([\d.]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(gpHtml)) !== null) {
        const [, mon, year, priceStr] = m;
        const raw = parseFloat(priceStr);
        const monthNum = MONTH_NAMES.indexOf(mon.toLowerCase()) + 1;
        if (monthNum < 1 || !raw) continue;
        const date = `${year}-${String(monthNum).padStart(2, "0")}-01`;
        let price50kg: number;
        if (raw >= 15 && raw <= 70) {
          price50kg = Math.round(raw * 50);
        } else if (raw >= 0.04 && raw <= 0.20) {
          price50kg = Math.round(raw * 50 * 285);
        } else continue;
        pts.push({ date, price: price50kg });
      }
      if (pts.length >= 3) return pts.sort((a, b) => a.date.localeCompare(b.date));
    }
    // Strategy 2: materialrate.pk monthly archives
    const scraped = await fetchCementMonthlyHistory().catch(() => [] as HistoryPoint[]);
    if (scraped.length >= 3) return scraped;
    // Strategy 3: LUCK.KA (Lucky Cement, KSE) — single max/weekly request to avoid rate limits
    const live = await getPakistanRawMaterials().catch(() => null);
    const anchor = live?.items.find(i => i.label === "Cement (Grey)")?.price ?? null;
    const raw = await fetchYahooHistory("LUCK.KA", "max", "1wk").catch(() => [] as HistoryPoint[]);
    if (raw.length === 0) return [];
    let scale = 1;
    if (anchor) {
      const last = raw[raw.length - 1].price;
      if (last > 0) scale = anchor / last;
    }
    return raw.sort((a, b) => a.date.localeCompare(b.date))
              .map(p => ({ date: p.date, price: Math.round(p.price * scale) }));
  },
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const loader = SYMBOL_LOADERS[symbol];
  if (!loader) {
    return NextResponse.json({ error: "Unknown symbol" }, { status: 400 });
  }
  const { value } = await getStaleCached({
    key: `public:commodity-history-v4:${symbol}`,
    ttlSeconds: 4 * 60 * 60,
    staleSeconds: 7 * 24 * 60 * 60,
    load: loader,
  });
  return NextResponse.json(
    { data: value },
    { headers: { "Cache-Control": "s-maxage=14400, stale-while-revalidate=604800" } }
  );
}
