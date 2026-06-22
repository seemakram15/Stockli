import "server-only";
import { getEodCandlesCached } from "@/lib/services/history";
import type { Transaction } from "@/lib/types";

export interface CalendarDay {
  date: string; // YYYY-MM-DD (UTC day of the candle)
  close: number;
  /** Stock's own daily % move (close vs previous close). */
  changePct: number;
  /** Position P/L for the day in PKR (0 when no position). */
  dayPL: number;
  /** Position daily return %. */
  dayPLPct: number;
}

export interface StockCalendar {
  days: CalendarDay[];
  hasPosition: boolean;
  firstDate: string | null;
}

function isoDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Build the daily gain/loss calendar for a symbol.
 *
 * With a position (BUY/SELL transactions), the series is SCOPED to start at the
 * first purchase — nothing before it — and each day's P/L uses the shares held
 * THAT day, with correct cash-flow accounting:
 *
 *   dayPL[D] = sharesHeld[D]·close[D] − sharesHeld[D-1]·close[D-1] − cashIn[D]
 *
 * So on the buy day it's shares·(close − buyPrice); on a later top-up day the
 * existing shares get the day-over-day move while only the NEW shares are
 * measured against the new buy price — old gains are never retroactively
 * changed. Sells reduce shares and feed cash back in. Weekend/holiday buys are
 * applied on the next trading day.
 *
 * Without a position, it falls back to the stock's own daily % moves.
 */
export async function getStockCalendar(
  symbol: string,
  transactions: Transaction[]
): Promise<StockCalendar> {
  const candles = await getEodCandlesCached(symbol);
  if (candles.length === 0) return { days: [], hasPosition: false, firstDate: null };

  const trades = transactions
    .filter((t) => t.type === "BUY" || t.type === "SELL")
    .map((t) => ({
      date: t.transacted_at.slice(0, 10),
      qty: t.type === "BUY" ? t.quantity : -t.quantity,
      cash: t.type === "BUY" ? t.quantity * t.price : -t.quantity * t.price,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hasPosition = trades.some((t) => t.qty > 0);

  if (!hasPosition) {
    const days: CalendarDay[] = candles.map((c, i) => {
      const prev = i > 0 ? candles[i - 1].close : c.open;
      return {
        date: isoDay(c.time),
        close: c.close,
        changePct: prev ? ((c.close - prev) / prev) * 100 : 0,
        dayPL: 0,
        dayPLPct: 0,
      };
    });
    return { days, hasPosition: false, firstDate: null };
  }

  const firstBuyDate = trades.find((t) => t.qty > 0)!.date;
  const startIdx = candles.findIndex((c) => isoDay(c.time) >= firstBuyDate);
  if (startIdx === -1) return { days: [], hasPosition: true, firstDate: firstBuyDate };

  const days: CalendarDay[] = [];
  let shares = 0;
  let prevClose = startIdx > 0 ? candles[startIdx - 1].close : candles[startIdx].open;
  let tradeIdx = 0;

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];
    const date = isoDay(c.time);

    // Apply all trades dated on/before this trading day.
    let cashIn = 0;
    let deltaShares = 0;
    while (tradeIdx < trades.length && trades[tradeIdx].date <= date) {
      deltaShares += trades[tradeIdx].qty;
      cashIn += trades[tradeIdx].cash;
      tradeIdx++;
    }
    const prevShares = shares;
    shares = Math.max(0, shares + deltaShares);

    const prevMV = prevShares * prevClose;
    const curMV = shares * c.close;
    const dayPL = curMV - prevMV - cashIn;
    const basis = prevMV + Math.max(0, cashIn);
    const dayPLPct = basis > 0 ? (dayPL / basis) * 100 : 0;
    const changePct = prevClose ? ((c.close - prevClose) / prevClose) * 100 : 0;

    days.push({ date, close: c.close, changePct, dayPL, dayPLPct });
    prevClose = c.close;
  }

  return { days, hasPosition: true, firstDate: firstBuyDate };
}
