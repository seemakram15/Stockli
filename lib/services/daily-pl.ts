import "server-only";
import { psx } from "@/lib/psx/adapter";
import type { Candle } from "@/lib/types";

export interface DayPL {
  date: string; // YYYY-MM-DD (UTC day of the candle)
  close: number;
  /** Per-share day change vs previous close. */
  changePerShare: number;
  changePct: number;
  /** Position-level P/L for the day = changePerShare * quantity. */
  dayPL: number;
  closeValue: number;
}

/**
 * Per-day gain/loss series for a symbol, scaled by `quantity`. Powers the
 * large daily P/L calendar on the stock detail page. Derived from EOD candles
 * (day-over-day close change). When live data is unavailable the adapter
 * returns deterministic mock candles, so the calendar always renders.
 */
export async function getDailyPL(
  symbol: string,
  quantity = 1
): Promise<DayPL[]> {
  const candles = await psx.getEodCandles(symbol);
  return candlesToDailyPL(candles, quantity);
}

export function candlesToDailyPL(candles: Candle[], quantity = 1): DayPL[] {
  const out: DayPL[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.open;
    const changePerShare = c.close - prevClose;
    const changePct = prevClose !== 0 ? (changePerShare / prevClose) * 100 : 0;
    out.push({
      date: isoDay(c.time),
      close: c.close,
      changePerShare,
      changePct,
      dayPL: changePerShare * quantity,
      closeValue: c.close * quantity,
    });
  }
  return out;
}

function isoDay(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  return d.toISOString().slice(0, 10);
}
