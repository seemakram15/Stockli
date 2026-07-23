import { type NextRequest, NextResponse } from "next/server";
import { getStaleCached } from "@/lib/cache/stale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface HistoryPoint {
  date: string;
  price: number;
}

const YAHOO_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const HEADERS = {
  accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; Stockli/1.0; +https://mystockli.com)",
};

async function fetchYahooHistory(symbol: string, range: string, interval: string): Promise<HistoryPoint[]> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    headers: HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${symbol}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];
  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const price = closes[i];
    if (price == null || !Number.isFinite(price)) continue;
    points.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      price,
    });
  }
  return points;
}

async function fetchMerged(yahooSymbol: string): Promise<HistoryPoint[]> {
  const [daily, allTime] = await Promise.all([
    fetchYahooHistory(yahooSymbol, "1y", "1d"),
    fetchYahooHistory(yahooSymbol, "max", "1wk"),
  ]);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString().slice(0, 10);
  const historic = allTime.filter((p) => p.date < cutoff);
  const seen = new Set<string>();
  const merged = [...historic, ...daily].sort((a, b) => a.date.localeCompare(b.date));
  return merged.filter((p) => {
    if (seen.has(p.date)) return false;
    seen.add(p.date);
    return true;
  });
}

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("symbol") ?? "").trim();
  if (!raw || raw.length > 32 || !/^[A-Za-z0-9.^/=_-]+$/.test(raw)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  try {
    const { value } = await getStaleCached({
      key: `public:yahoo-history-v1:${raw}`,
      ttlSeconds: 60 * 60,
      staleSeconds: 24 * 60 * 60,
      load: () => fetchMerged(raw),
    });
    return NextResponse.json(
      { data: value },
      { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch {
    return NextResponse.json({ data: [] as HistoryPoint[] });
  }
}
