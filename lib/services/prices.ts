import "server-only";
import type { MarketWatchRow, Quote } from "@/lib/types";
import { psx } from "@/lib/psx/adapter";
import { getRedis } from "@/lib/cache/redis";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/config";
import { PRICE_CACHE_TTL_SECONDS } from "@/lib/constants";
import { normalizeSymbol, normalizeSymbols } from "@/lib/security/validation";

/**
 * Price service — the single hot path for quotes.
 *
 *   getQuotes(symbols)  reads the Upstash cache; on miss it runs ONE batched
 *                       /market-watch scrape (not per-symbol), warms the cache
 *                       (15-min TTL) and persists snapshots to Supabase.
 *
 * This keeps us within Vercel Hobby + Upstash free limits and matches the
 * spec's "one batched scrape" guidance.
 */

const priceKey = (symbol: string) => `psx:price:${symbol.toUpperCase()}`;
const MARKET_WATCH_KEY = "psx:marketwatch";

export function marketWatchRowToQuote(row: MarketWatchRow): Quote {
  return {
    symbol: row.symbol.toUpperCase(),
    price: row.current,
    ldcp: row.ldcp,
    open: row.open,
    high: row.high,
    low: row.low,
    change: row.change,
    changePct: row.changePct,
    volume: row.volume,
    capturedAt: new Date().toISOString(),
  };
}

async function readCache(symbols: string[]): Promise<Map<string, Quote>> {
  const redis = getRedis();
  const found = new Map<string, Quote>();
  if (!redis || symbols.length === 0) return found;
  try {
    const keys = symbols.map(priceKey);
    const values = await redis.mget<(Quote | null)[]>(...keys);
    values.forEach((v, i) => {
      if (v && typeof v === "object") found.set(symbols[i].toUpperCase(), v);
    });
  } catch (err) {
    console.warn("[prices] cache read failed:", err);
  }
  return found;
}

async function writeCache(quotes: Quote[]): Promise<void> {
  const redis = getRedis();
  if (!redis || quotes.length === 0) return;
  try {
    const pipe = redis.pipeline();
    for (const q of quotes) {
      pipe.set(priceKey(q.symbol), q, { ex: PRICE_CACHE_TTL_SECONDS });
    }
    await pipe.exec();
  } catch (err) {
    console.warn("[prices] cache write failed:", err);
  }
}

/** Persist snapshots to Supabase (idempotent upsert) — best effort. */
async function persistSnapshots(quotes: Quote[]): Promise<void> {
  if (!isSupabaseAdminConfigured || quotes.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = quotes.map((q) => ({
      symbol: q.symbol,
      price: q.price,
      ldcp: q.ldcp,
      open: q.open,
      high: q.high,
      low: q.low,
      change: q.change,
      change_pct: q.changePct,
      volume: q.volume,
      captured_at: q.capturedAt,
    }));
    await admin.from("price_snapshots").insert(rows);
  } catch (err) {
    console.warn("[prices] snapshot persist failed:", err);
  }
}

/** Scrape the live market watch and warm every cache + persist snapshots. */
async function scrapeAndStore(): Promise<MarketWatchRow[]> {
  const rows = await psx.getMarketWatch();
  const quotes = rows.map(marketWatchRowToQuote);
  const redis = getRedis();
  await Promise.all([
    writeCache(quotes),
    persistSnapshots(quotes),
    redis
      ? redis
          .set(MARKET_WATCH_KEY, rows, { ex: PRICE_CACHE_TTL_SECONDS })
          .catch(() => undefined)
      : Promise.resolve(),
  ]);
  return rows;
}

/**
 * Run the batched market-watch refresh: scrape → cache → persist.
 * Returns a map of every symbol's quote. Safe to call repeatedly (idempotent).
 */
export async function refreshMarketWatch(): Promise<Map<string, Quote>> {
  const rows = await scrapeAndStore();
  return new Map(rows.map((r) => [r.symbol.toUpperCase(), marketWatchRowToQuote(r)]));
}

/**
 * The full market snapshot (all rows incl. sector), cache-first. Powers the
 * Market page without re-scraping on every visit.
 */
export async function getMarketRows(): Promise<MarketWatchRow[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<MarketWatchRow[]>(MARKET_WATCH_KEY);
      if (cached && cached.length) return cached;
    } catch {
      /* fall through */
    }
  }
  return scrapeAndStore();
}

/** Get quotes for the given symbols, using cache first then a batched refresh. */
export async function getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const wanted = normalizeSymbols(symbols, 100);
  if (wanted.length === 0) return new Map();

  const cached = await readCache(wanted);
  const misses = wanted.filter((s) => !cached.has(s));
  if (misses.length === 0) return cached;

  // Any miss triggers one batched refresh that covers all symbols at once.
  const fresh = await refreshMarketWatch();
  const result = new Map<string, Quote>();
  for (const s of wanted) {
    const q = cached.get(s) ?? fresh.get(s);
    if (q) result.set(s, q);
  }
  return result;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return null;
  const map = await getQuotes([normalized]);
  return map.get(normalized) ?? null;
}

/** All quotes from the latest market snapshot (cache-first). */
export async function getAllQuotes(): Promise<Quote[]> {
  const rows = await getMarketRows();
  return rows.map(marketWatchRowToQuote);
}
