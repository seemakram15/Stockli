import type {
  Candle,
  IndexConstituent,
  IndexSummary,
  MarketWatchRow,
  Quote,
  SeriesPoint,
} from "@/lib/types";
import { SEED_TICKERS, getRefPrice, PSX_INDICES } from "./symbols";

/**
 * Deterministic, seeded mock data. Used as the DEMO-MODE source and as a
 * graceful fallback when the live PSX scrape fails. Seeding from the symbol
 * keeps output stable across renders (no hydration mismatches).
 */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — deterministic given a seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_SECONDS = 86400;

/** UTC midnight (seconds) for a date `offset` days before `now`. */
function utcDayStart(now: Date, daysAgo: number): number {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return Math.floor(d.getTime() / 1000) - daysAgo * DAY_SECONDS;
}

/**
 * Generate `days` of daily OHLC candles ending today, skipping weekends.
 * A seeded random walk anchored to the ticker's reference price.
 */
export function genEodCandles(
  symbol: string,
  days = 500,
  now: Date = new Date()
): Candle[] {
  const isIndex = PSX_INDICES.some((i) => i.symbol === symbol.toUpperCase());
  const base = getRefPrice(symbol) ?? 50 + (hashString(symbol) % 400);
  const rand = mulberry32(hashString(symbol));

  // Build forward from `days` ago so the most recent close lands near `base`.
  const candles: Candle[] = [];
  let price = base * (0.55 + rand() * 0.25); // start lower, trend up to base-ish
  const drift = Math.pow(base / price, 1 / days); // gentle upward drift

  for (let i = days; i >= 0; i--) {
    const ts = utcDayStart(now, i);
    const dow = new Date(ts * 1000).getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    // Indices move far less per day than single stocks.
    const vol = isIndex ? 0.003 + rand() * 0.006 : 0.012 + rand() * 0.02;
    const shock = (rand() - 0.5) * 2 * vol;
    const open = price;
    let close = open * drift * (1 + shock);
    if (close <= 0.5) close = open * 0.98;
    const hi = Math.max(open, close) * (1 + rand() * vol * 0.6);
    const lo = Math.min(open, close) * (1 - rand() * vol * 0.6);
    const volume = Math.round((50_000 + rand() * 4_000_000) / 100) * 100;

    candles.push({
      time: ts,
      open: round2(open),
      high: round2(hi),
      low: round2(lo),
      close: round2(close),
      volume,
    });
    price = close;
  }
  return candles;
}

/** Intraday series for the current session (5-min steps). */
export function genIntraday(
  symbol: string,
  now: Date = new Date()
): SeriesPoint[] {
  const candles = genEodCandles(symbol, 5, now);
  const last = candles[candles.length - 1];
  const prevClose = candles[candles.length - 2]?.close ?? last.open;
  const rand = mulberry32(hashString(symbol + "intraday"));
  const points: SeriesPoint[] = [];

  const sessionStart = utcDayStart(now, 0) + 9 * 3600 + 30 * 60; // ~09:30 UTC proxy
  let price = prevClose;
  const steps = 72; // 6h of 5-min candles
  for (let i = 0; i <= steps; i++) {
    const shock = (rand() - 0.5) * 0.006;
    price = price * (1 + shock);
    points.push({ time: sessionStart + i * 300, value: round2(price) });
  }
  return points;
}

/** A current quote derived from the latest two candles. */
export function genQuote(symbol: string, now: Date = new Date()): Quote {
  const candles = genEodCandles(symbol, 10, now);
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const ldcp = prev.close;
  const price = last.close;
  const change = round2(price - ldcp);
  const changePct = round2((change / ldcp) * 100);
  return {
    symbol: symbol.toUpperCase(),
    price,
    ldcp,
    open: last.open,
    high: last.high,
    low: last.low,
    change,
    changePct,
    volume: last.volume ?? null,
    capturedAt: now.toISOString(),
  };
}

/** A full /market-watch snapshot across all seed tickers. */
export function genMarketWatch(now: Date = new Date()): MarketWatchRow[] {
  return SEED_TICKERS.map((t) => {
    const q = genQuote(t.symbol, now);
    return {
      symbol: t.symbol,
      sector: t.sector,
      listedIn: "REG",
      ldcp: q.ldcp,
      open: q.open,
      high: q.high,
      low: q.low,
      current: q.price,
      change: q.change,
      changePct: q.changePct,
      volume: q.volume,
    };
  });
}

/** Live index summaries (demo). */
export function genIndexSummaries(now: Date = new Date()): IndexSummary[] {
  return PSX_INDICES.map((idx) => {
    const q = genQuote(idx.symbol, now);
    return {
      symbol: idx.symbol,
      current: q.price,
      change: q.change,
      changePct: q.changePct,
      high: q.high,
      low: q.low,
    };
  });
}

/** Index constituents with synthetic weights summing ~100% (demo). */
export function genIndexConstituents(
  symbol: string,
  now: Date = new Date()
): IndexConstituent[] {
  // Pick a deterministic subset sized to the index.
  const sym = symbol.toUpperCase();
  const size = sym.includes("30") ? 30 : sym.includes("DIV") ? 20 : SEED_TICKERS.length;
  const picks = SEED_TICKERS.slice(0, Math.min(size, SEED_TICKERS.length));
  const caps = picks.map((t) => t.ref * (50 + (hashString(t.symbol) % 200)));
  const total = caps.reduce((a, b) => a + b, 0) || 1;
  return picks.map((t, i) => {
    const q = genQuote(t.symbol, now);
    return {
      symbol: t.symbol,
      name: t.company,
      ldcp: q.ldcp,
      current: q.price,
      change: q.change,
      changePct: q.changePct,
      weight: round2((caps[i] / total) * 100),
      idxPoint: round2(q.changePct * (caps[i] / total) * 10),
      volume: q.volume,
    };
  }).sort((a, b) => b.weight - a.weight);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
