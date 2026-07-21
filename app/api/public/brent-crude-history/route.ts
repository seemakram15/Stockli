import { NextResponse } from "next/server";
import { getStaleCached } from "@/lib/cache/stale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HistoryPoint {
  date: string;
  price: number;
}

async function fetchBrentHistory(): Promise<HistoryPoint[]> {
  const url = "https://query2.finance.yahoo.com/v8/finance/chart/BZ%3DF?range=2y&interval=1wk";
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; Stockli/1.0; +https://mystockli.qzz.io)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: number[] = result?.indicators?.quote?.[0]?.close ?? [];
  const points: HistoryPoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const price = closes[i];
    if (price == null || !Number.isFinite(price)) continue;
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    points.push({ date, price: Math.round(price * 100) / 100 });
  }
  return points;
}

export async function GET() {
  const { value } = await getStaleCached({
    key: "public:brent-crude-history-v1",
    ttlSeconds: 4 * 60 * 60,
    staleSeconds: 7 * 24 * 60 * 60,
    load: fetchBrentHistory,
  });
  return NextResponse.json(
    { data: value },
    { headers: { "Cache-Control": "s-maxage=14400, stale-while-revalidate=604800" } }
  );
}
