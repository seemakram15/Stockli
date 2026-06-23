import "server-only";
import { isDemoMode } from "@/lib/config";
import { getEodCandlesCached } from "@/lib/services/history";
import { createClient } from "@/lib/supabase/server";
import type { DailyPL, Holding, Transaction } from "@/lib/types";

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
  transactions: Transaction[],
  options: { skipPersisted?: boolean } = {}
): Promise<StockCalendar> {
  const trades = transactions
    .filter((t) => t.type === "BUY" || t.type === "SELL")
    .map((t) => ({
      date: t.transacted_at.slice(0, 10),
      qty: t.type === "BUY" ? t.quantity : -t.quantity,
      cash: t.type === "BUY" ? t.quantity * t.price : -t.quantity * t.price,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const hasPosition = trades.some((t) => t.qty > 0);
  const persisted = options.skipPersisted
    ? []
    : await getPersistedCalendarDays(
        Array.from(new Set(transactions.map((t) => t.portfolio_id))),
        symbol
      );
  const persistedFirstDate = persisted[0]?.date ?? null;

  const candles = await getEodCandlesCached(symbol);
  if (candles.length === 0) {
    return {
      days: persisted,
      hasPosition: hasPosition || persisted.length > 0,
      firstDate: trades.find((t) => t.qty > 0)?.date ?? persistedFirstDate,
    };
  }

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
    return {
      days: mergeCalendarDays(days, persisted),
      hasPosition: persisted.length > 0,
      firstDate: persistedFirstDate,
    };
  }

  const firstBuyDate = trades.find((t) => t.qty > 0)!.date;
  const startIdx = candles.findIndex((c) => isoDay(c.time) >= firstBuyDate);
  if (startIdx === -1) {
    return {
      days: persisted,
      hasPosition: true,
      firstDate: firstBuyDate ?? persistedFirstDate,
    };
  }

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

  return {
    days: mergeCalendarDays(days, persisted),
    hasPosition: true,
    firstDate:
      persistedFirstDate && persistedFirstDate < firstBuyDate
        ? persistedFirstDate
        : firstBuyDate,
  };
}

/**
 * Aggregate daily P/L across the current holdings in one portfolio.
 *
 * Each symbol is calculated with the same cash-flow-aware accounting as the
 * stock detail calendar, then summed by date. The client calendar can overlay
 * today's live quote change, so the current session appears before EOD candles
 * are published.
 */
export async function getPortfolioCalendar(
  holdings: Pick<Holding, "symbol" | "portfolio_id">[],
  transactions: Transaction[]
): Promise<StockCalendar> {
  const symbols = Array.from(new Set(holdings.map((h) => h.symbol.toUpperCase())));
  if (symbols.length === 0) return { days: [], hasPosition: false, firstDate: null };
  const persisted = await getPersistedCalendarDays(
    Array.from(new Set(holdings.map((h) => h.portfolio_id)))
  );

  const calendars = await Promise.all(
    symbols.map(async (symbol) => {
      const symbolTxns = transactions.filter((t) => t.symbol.toUpperCase() === symbol);
      return getStockCalendar(symbol, symbolTxns, { skipPersisted: true });
    })
  );

  const byDate = new Map<string, CalendarDay>();
  let firstDate: string | null = null;

  for (const calendar of calendars) {
    if (calendar.firstDate && (!firstDate || calendar.firstDate < firstDate)) {
      firstDate = calendar.firstDate;
    }
    for (const day of calendar.days) {
      const existing =
        byDate.get(day.date) ??
        ({
          date: day.date,
          close: 0,
          changePct: 0,
          dayPL: 0,
          dayPLPct: 0,
        } satisfies CalendarDay);
      existing.close += day.close;
      existing.dayPL += day.dayPL;
      byDate.set(day.date, existing);
    }
  }

  return {
    days: mergeCalendarDays(
      Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
      persisted
    ),
    hasPosition: true,
    firstDate:
      persisted[0]?.date && (!firstDate || persisted[0].date < firstDate)
        ? persisted[0].date
        : firstDate,
  };
}

async function getPersistedCalendarDays(
  portfolioIds: string[],
  symbol?: string
): Promise<CalendarDay[]> {
  if (isDemoMode) return [];
  const ids = Array.from(new Set(portfolioIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const supabase = await createClient();
  let query = supabase
    .from("daily_pl")
    .select("portfolio_id,symbol,date,open_value,close_value,day_pl,day_pl_pct")
    .in("portfolio_id", ids)
    .order("date", { ascending: true });
  if (symbol) query = query.eq("symbol", symbol.toUpperCase());

  const { data } = await query;
  return aggregatePersistedRows(
    (data as Pick<
      DailyPL,
      "portfolio_id" | "symbol" | "date" | "open_value" | "close_value" | "day_pl" | "day_pl_pct"
    >[] | null) ?? []
  );
}

function aggregatePersistedRows(
  rows: Pick<
    DailyPL,
    "date" | "open_value" | "close_value" | "day_pl" | "day_pl_pct"
  >[]
): CalendarDay[] {
  const byDate = new Map<
    string,
    { date: string; openValue: number; closeValue: number; dayPL: number }
  >();

  for (const row of rows) {
    const existing =
      byDate.get(row.date) ??
      ({
        date: row.date,
        openValue: 0,
        closeValue: 0,
        dayPL: 0,
      } satisfies { date: string; openValue: number; closeValue: number; dayPL: number });
    existing.openValue += Number(row.open_value ?? 0);
    existing.closeValue += Number(row.close_value ?? 0);
    existing.dayPL += Number(row.day_pl ?? 0);
    byDate.set(row.date, existing);
  }

  return Array.from(byDate.values())
    .map((row) => ({
      date: row.date,
      close: row.closeValue,
      changePct: row.openValue ? (row.dayPL / row.openValue) * 100 : 0,
      dayPL: row.dayPL,
      dayPLPct: row.openValue ? (row.dayPL / row.openValue) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mergeCalendarDays(calculated: CalendarDay[], persisted: CalendarDay[]) {
  if (persisted.length === 0) return calculated;
  const byDate = new Map(calculated.map((day) => [day.date, day]));
  for (const day of persisted) byDate.set(day.date, day);
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}
