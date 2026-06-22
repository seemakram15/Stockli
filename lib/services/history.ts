import "server-only";
import { psx } from "@/lib/psx/adapter";
import { getRedis } from "@/lib/cache/redis";
import type { Candle, SeriesPoint } from "@/lib/types";

/**
 * Cached historical series. EOD candles change at most once a day, so we cache
 * them for several hours; intraday for a few minutes. This is the main
 * page-speed win — repeat loads of the dashboard/stock pages hit Redis instead
 * of re-scraping PSX per symbol.
 */
const EOD_TTL = 6 * 60 * 60; // 6 hours
const INTRADAY_TTL = 5 * 60; // 5 minutes

export async function getEodCandlesCached(symbol: string): Promise<Candle[]> {
  const sym = symbol.toUpperCase();
  const redis = getRedis();
  const key = `psx:eod:${sym}`;
  if (redis) {
    try {
      const cached = await redis.get<Candle[]>(key);
      if (cached && cached.length) return cached;
    } catch {
      /* fall through to live */
    }
  }
  const candles = await psx.getEodCandles(sym);
  if (redis && candles.length) {
    try {
      await redis.set(key, candles, { ex: EOD_TTL });
    } catch {
      /* best effort */
    }
  }
  return candles;
}

export async function getIntradayCached(symbol: string): Promise<SeriesPoint[]> {
  const sym = symbol.toUpperCase();
  const redis = getRedis();
  const key = `psx:int:${sym}`;
  if (redis) {
    try {
      const cached = await redis.get<SeriesPoint[]>(key);
      if (cached && cached.length) return cached;
    } catch {
      /* fall through */
    }
  }
  const pts = await psx.getIntraday(sym);
  if (redis && pts.length) {
    try {
      await redis.set(key, pts, { ex: INTRADAY_TTL });
    } catch {
      /* best effort */
    }
  }
  return pts;
}
