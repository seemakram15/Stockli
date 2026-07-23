import type { Candle, Quote } from "@/lib/types";

/** Client-safe market snapshot derived from live quote + EOD candles. */
export interface StockMarketSnapshot {
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  price: number | null;
  week52High: number | null;
  week52Low: number | null;
  /** 0–100 position of current price in the 52-week range. */
  posIn52w: number | null;
  change6m: number | null;
  change1y: number | null;
  changeYtd: number | null;
}

function calendarReturn(
  candles: Candle[],
  current: number,
  days: number
): number | null {
  if (!candles.length || !Number.isFinite(current)) return null;
  const lastTime = candles[candles.length - 1]?.time ?? 0;
  const target = lastTime - days * 86_400;
  let base = candles[0];
  for (const candle of candles) {
    if (candle.time <= target) base = candle;
    else break;
  }
  if (!base?.close) return null;
  return ((current - base.close) / base.close) * 100;
}

function ytdReturn(candles: Candle[], current: number): number | null {
  if (!candles.length || !Number.isFinite(current)) return null;
  const lastYear = new Date(candles[candles.length - 1].time * 1000).getUTCFullYear();
  const firstOfYear = candles.find(
    (c) => new Date(c.time * 1000).getUTCFullYear() === lastYear
  );
  if (!firstOfYear?.close) return null;
  return ((current - firstOfYear.close) / firstOfYear.close) * 100;
}

export function computeStockMarketSnapshot(
  quote: Quote | null | undefined,
  candles: Candle[] | null | undefined
): StockMarketSnapshot {
  const series = candles ?? [];
  const price =
    quote?.price != null && Number.isFinite(quote.price)
      ? quote.price
      : series.length
        ? series[series.length - 1].close
        : null;

  const year = series.slice(-252);
  const week52High =
    year.length || price != null
      ? Math.max(price ?? Number.NEGATIVE_INFINITY, ...year.map((c) => c.high))
      : null;
  const week52Low =
    year.length || price != null
      ? Math.min(price ?? Number.POSITIVE_INFINITY, ...year.map((c) => c.low))
      : null;

  let posIn52w: number | null = null;
  if (
    price != null &&
    week52High != null &&
    week52Low != null &&
    Number.isFinite(week52High) &&
    Number.isFinite(week52Low)
  ) {
    const range = week52High - week52Low;
    posIn52w = range > 0 ? Math.min(100, Math.max(0, ((price - week52Low) / range) * 100)) : 50;
  }

  return {
    open: quote?.open ?? null,
    high: quote?.high ?? null,
    low: quote?.low ?? null,
    volume: quote?.volume ?? null,
    price,
    week52High: week52High != null && Number.isFinite(week52High) ? week52High : null,
    week52Low: week52Low != null && Number.isFinite(week52Low) ? week52Low : null,
    posIn52w,
    change6m: price != null ? calendarReturn(series, price, 182) : null,
    change1y: price != null ? calendarReturn(series, price, 365) : null,
    changeYtd: price != null ? ytdReturn(series, price) : null,
  };
}
