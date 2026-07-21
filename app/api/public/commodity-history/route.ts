import { type NextRequest, NextResponse } from "next/server";
import { getStaleCached } from "@/lib/cache/stale";
import { getPakistanCommodities } from "@/lib/services/pakistan-commodities";

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
