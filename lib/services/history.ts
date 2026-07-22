import "server-only";
import { psx } from "@/lib/psx/adapter";
import { getRedis, getRedisClients } from "@/lib/cache/redis";
import { deleteMemoryCache, getOrSetMemoryCache, setMemoryCache } from "@/lib/cache/memory";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { PSX_INDICES } from "@/lib/psx/symbols";
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
const EOD_CACHE_VERSION = "v4";

/** Yahoo Finance long-history tickers for PSX indices (PSX DPS only keeps ~5y). */
const YAHOO_INDEX_HISTORY: Record<string, string> = {
  KSE100: "^KSE",
};

const YAHOO_UA =
  "Mozilla/5.0 (compatible; Stockli/1.0; +https://mystockli.qzz.io)";

/** Floor unix seconds to UTC midnight so daily bars stay unique for charts. */
function toUtcDay(ts: number): number {
  const d = new Date(ts * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
}

/** Keep one candle per UTC day (last wins), sorted ascending. */
function dedupeCandlesByDay(candles: Candle[]): Candle[] {
  const byDay = new Map<number, Candle>();
  for (const c of candles) {
    const day = toUtcDay(c.time);
    byDay.set(day, { ...c, time: day });
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => c);
}

function eodCacheTtl() {
  return shouldRefreshPsxData() ? EOD_TTL : Math.max(EOD_TTL, psxLiveCacheTtlSeconds());
}

function intradayCacheTtl() {
  return shouldRefreshPsxData() ? INTRADAY_TTL : psxLiveCacheTtlSeconds();
}

function indexCacheTtl() {
  return shouldRefreshPsxData() ? INDEX_TTL : psxLiveCacheTtlSeconds();
}

function isPsxIndex(symbol: string) {
  return PSX_INDICES.some((i) => i.symbol === symbol.toUpperCase());
}

export async function getEodCandlesCached(symbol: string): Promise<Candle[]> {
  const sym = symbol.toUpperCase();
  return getOrSetMemoryCache(
    `psx:eod:${EOD_CACHE_VERSION}:${sym}`,
    eodCacheTtl(),
    () => loadEodCandles(sym),
    (candles) => candles.length > 0
  );
}

async function loadEodCandles(sym: string): Promise<Candle[]> {
  const redis = getRedis();
  const key = `psx:eod:${EOD_CACHE_VERSION}:${sym}`;
  if (redis) {
    try {
      const cached = await redis.get<Candle[]>(key);
      if (cached && cached.length) return cached;
    } catch {
      /* fall through to live */
    }
  }
  const raw = isPsxIndex(sym)
    ? await loadIndexEodCandles(sym)
    : await psx.getEodCandles(sym);
  const candles = dedupeCandlesByDay(raw);
  if (redis && candles.length) {
    try {
      await redis.set(key, candles, { ex: eodCacheTtl() });
    } catch {
      /* best effort */
    }
  }
  return candles;
}

/** PSX live EOD (~5y) merged with Yahoo long history when available (KSE100 → 1997). */
async function loadIndexEodCandles(sym: string): Promise<Candle[]> {
  const psxCandles = dedupeCandlesByDay(
    await psx.getEodCandles(sym).catch(() => [] as Candle[])
  );
  const yahooSymbol = YAHOO_INDEX_HISTORY[sym];
  if (!yahooSymbol) return psxCandles;

  const yahooCandles = dedupeCandlesByDay(
    await fetchYahooIndexHistory(yahooSymbol).catch(() => [] as Candle[])
  );
  if (!yahooCandles.length) return psxCandles;
  if (!psxCandles.length) return yahooCandles;

  const psxStart = psxCandles[0].time;
  const historic = yahooCandles.filter((c) => c.time < psxStart);
  return dedupeCandlesByDay([...historic, ...psxCandles]);
}

async function fetchYahooIndexHistory(yahooSymbol: string): Promise<Candle[]> {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  let lastError: unknown;
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=max&interval=1mo`;
      const res = await fetch(url, {
        headers: { accept: "application/json", "User-Agent": YAHOO_UA },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Yahoo ${res.status} for ${yahooSymbol}`);
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
        };
      };
      const result = json.chart?.result?.[0];
      const timestamps = result?.timestamp ?? [];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const candles: Candle[] = [];
      let prevClose: number | null = null;
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (close == null || !Number.isFinite(close)) continue;
        const open = prevClose ?? close;
        candles.push({
          time: Math.floor(timestamps[i]),
          open,
          high: Math.max(open, close),
          low: Math.min(open, close),
          close,
        });
        prevClose = close;
      }
      if (candles.length) return candles;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Yahoo history failed for ${yahooSymbol}`);
}

export async function getIntradayCached(symbol: string): Promise<SeriesPoint[]> {
  const sym = symbol.toUpperCase();
  return getOrSetMemoryCache(
    `psx:int:v2:${sym}`,
    intradayCacheTtl(),
    () => loadIntraday(sym),
    (points) => points.length > 0
  );
}

async function loadIntraday(sym: string): Promise<SeriesPoint[]> {
  const redis = getRedis();
  const key = `psx:int:v2:${sym}`;
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

/** Drop cached index summaries/constituents so the next read scrapes PSX again. */
export async function invalidateIndexCaches(): Promise<void> {
  deleteMemoryCache("psx:indices");
  for (const index of PSX_INDICES) {
    deleteMemoryCache(`psx:cons:${index.symbol}`);
  }
  await Promise.allSettled(
    getRedisClients().flatMap((redis) => [
      redis.del("psx:indices"),
      ...PSX_INDICES.map((index) => redis.del(`psx:cons:${index.symbol}`)),
    ])
  );
}

/** Force a fresh `/indices` scrape into memory + Redis. */
export async function refreshIndexSummaries(): Promise<IndexSummary[]> {
  await invalidateIndexCaches();
  const rows = await psx.getIndexSummaries();
  if (rows.length) {
    const ttl = indexCacheTtl();
    setMemoryCache("psx:indices", rows, ttl);
    const redis = getRedis();
    if (redis) {
      try {
        await redis.set("psx:indices", rows, { ex: ttl });
      } catch {
        /* best effort */
      }
    }
  }
  return rows;
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
