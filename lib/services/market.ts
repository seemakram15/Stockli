import "server-only";
import { getEodCandlesCached } from "@/lib/services/history";
import { getMarketRows } from "@/lib/services/prices";
import { PSX_INDICES } from "@/lib/psx/symbols";
import type { Candle } from "@/lib/types";

export interface IndexReturns {
  d1: number;
  w1: number;
  m1: number;
  m3: number;
  y1: number;
  ytd: number;
}

export interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePct: number;
  returns: IndexReturns;
  spark: number[];
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
}

function buildIndex(meta: { symbol: string; name: string }, candles: Candle[]): IndexData {
  if (candles.length === 0) {
    return {
      symbol: meta.symbol,
      name: meta.name,
      value: 0,
      change: 0,
      changePct: 0,
      returns: { d1: 0, w1: 0, m1: 0, m3: 0, y1: 0, ytd: 0 },
      spark: [],
      dayHigh: 0,
      dayLow: 0,
      week52High: 0,
      week52Low: 0,
    };
  }
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const value = last?.close ?? 0;
  const change = value - (prev?.close ?? value);
  const changePct = prev?.close ? (change / prev.close) * 100 : 0;

  // Return over `n` trading days back.
  const back = (n: number) => {
    const idx = candles.length - 1 - n;
    const base = candles[Math.max(0, idx)]?.close;
    return base ? ((value - base) / base) * 100 : 0;
  };

  // YTD: first candle whose date is in the current (latest) calendar year.
  const lastYear = new Date((last?.time ?? 0) * 1000).getUTCFullYear();
  const firstOfYear = candles.find(
    (c) => new Date(c.time * 1000).getUTCFullYear() === lastYear
  );
  const ytd = firstOfYear?.close ? ((value - firstOfYear.close) / firstOfYear.close) * 100 : 0;

  const year = candles.slice(-252);
  return {
    symbol: meta.symbol,
    name: meta.name,
    value,
    change,
    changePct,
    returns: {
      d1: changePct,
      w1: back(5),
      m1: back(22),
      m3: back(66),
      y1: back(252),
      ytd,
    },
    spark: candles.slice(-32).map((c) => c.close),
    dayHigh: last?.high ?? value,
    dayLow: last?.low ?? value,
    week52High: year.length ? Math.max(...year.map((c) => c.high)) : value,
    week52Low: year.length ? Math.min(...year.map((c) => c.low)) : value,
  };
}

export async function getIndices(): Promise<IndexData[]> {
  return Promise.all(
    PSX_INDICES.map(async (idx) => buildIndex(idx, await getEodCandlesCached(idx.symbol)))
  );
}

export interface SectorStat {
  sector: string;
  count: number;
  avgChangePct: number;
  advances: number;
  declines: number;
  weight: number; // 0..1 share of listings, for bar width
}

export interface MarketBreadth {
  advances: number;
  declines: number;
  unchanged: number;
}

export async function getSectorBreakdown(): Promise<{
  sectors: SectorStat[];
  breadth: MarketBreadth;
}> {
  const rows = await getMarketRows();

  const map = new Map<string, { count: number; sum: number; up: number; down: number }>();
  let advances = 0;
  let declines = 0;
  let unchanged = 0;

  for (const r of rows) {
    const sector = r.sector?.trim() || "Other";
    const e = map.get(sector) ?? { count: 0, sum: 0, up: 0, down: 0 };
    e.count += 1;
    e.sum += r.changePct;
    if (r.changePct > 0) {
      e.up += 1;
      advances += 1;
    } else if (r.changePct < 0) {
      e.down += 1;
      declines += 1;
    } else {
      unchanged += 1;
    }
    map.set(sector, e);
  }

  const maxCount = Math.max(...Array.from(map.values()).map((e) => e.count), 1);
  const sectors: SectorStat[] = Array.from(map.entries())
    .map(([sector, e]) => ({
      sector,
      count: e.count,
      avgChangePct: e.count ? e.sum / e.count : 0,
      advances: e.up,
      declines: e.down,
      weight: e.count / maxCount,
    }))
    .sort((a, b) => b.count - a.count);

  return { sectors, breadth: { advances, declines, unchanged } };
}
