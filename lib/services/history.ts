import "server-only";
import { psx } from "@/lib/psx/adapter";
import { getRedis } from "@/lib/cache/redis";
import { getOrSetMemoryCache } from "@/lib/cache/memory";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { Candle, IndexConstituent, IndexSummary, SeriesPoint } from "@/lib/types";

/**
 * Cached historical series. EOD candles change at most once a day, so we cache
 * them for several hours; intraday for a few minutes. This is the main
 * page-speed win — repeat loads of the dashboard/stock pages hit Redis instead
 * of re-scraping PSX per symbol.
 */
const EOD_TTL = 6 * 60 * 60; // 6 hours
const INTRADAY_TTL = 5 * 60; // 5 minutes
const INDEX_TTL = 3 * 60; // 3 minutes (live-ish index data)

function eodCacheTtl() {
  return shouldRefreshPsxData() ? EOD_TTL : Math.max(EOD_TTL, psxLiveCacheTtlSeconds());
}

function intradayCacheTtl() {
  return shouldRefreshPsxData() ? INTRADAY_TTL : psxLiveCacheTtlSeconds();
}

function indexCacheTtl() {
  return shouldRefreshPsxData() ? INDEX_TTL : psxLiveCacheTtlSeconds();
}

export async function getEodCandlesCached(symbol: string): Promise<Candle[]> {
  const sym = symbol.toUpperCase();
  return getOrSetMemoryCache(
    `psx:eod:${sym}`,
    eodCacheTtl(),
    () => loadEodCandles(sym),
    (candles) => candles.length > 0
  );
}

async function loadEodCandles(sym: string): Promise<Candle[]> {
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
      await redis.set(key, candles, { ex: eodCacheTtl() });
    } catch {
      /* best effort */
    }
  }
  return candles;
}

export async function getIntradayCached(symbol: string): Promise<SeriesPoint[]> {
  const sym = symbol.toUpperCase();
  return getOrSetMemoryCache(
    `psx:int:${sym}`,
    intradayCacheTtl(),
    () => loadIntraday(sym),
    (points) => points.length > 0
  );
}

async function loadIntraday(sym: string): Promise<SeriesPoint[]> {
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
      await redis.set(key, pts, { ex: intradayCacheTtl() });
    } catch {
      /* best effort */
    }
  }
  return pts;
}

/** Live index summaries (all indices), cached ~3 min. */
export async function getIndexSummariesCached(): Promise<IndexSummary[]> {
  return getOrSetMemoryCache(
    "psx:indices",
    indexCacheTtl(),
    loadIndexSummaries,
    (rows) => rows.length > 0
  );
}

async function loadIndexSummaries(): Promise<IndexSummary[]> {
  const redis = getRedis();
  const key = "psx:indices";
  if (redis) {
    try {
      const cached = await redis.get<IndexSummary[]>(key);
      if (cached && cached.length) return cached;
    } catch {
      /* fall through */
    }
  }
  const rows = await psx.getIndexSummaries();
  if (redis && rows.length) {
    try {
      await redis.set(key, rows, { ex: indexCacheTtl() });
    } catch {
      /* best effort */
    }
  }
  return rows;
}

/** Index constituents (with weights), cached ~3 min. */
export async function getIndexConstituentsCached(
  symbol: string
): Promise<IndexConstituent[]> {
  const sym = symbol.toUpperCase();
  return getOrSetMemoryCache(
    `psx:cons:${sym}`,
    indexCacheTtl(),
    () => loadIndexConstituents(sym),
    (rows) => rows.length > 0
  );
}

async function loadIndexConstituents(sym: string): Promise<IndexConstituent[]> {
  const redis = getRedis();
  const key = `psx:cons:${sym}`;
  if (redis) {
    try {
      const cached = await redis.get<IndexConstituent[]>(key);
      if (cached && cached.length) return cached;
    } catch {
      /* fall through */
    }
  }
  const rows = await psx.getIndexConstituents(sym);
  if (redis && rows.length) {
    try {
      await redis.set(key, rows, { ex: indexCacheTtl() });
    } catch {
      /* best effort */
    }
  }
  return rows;
}
