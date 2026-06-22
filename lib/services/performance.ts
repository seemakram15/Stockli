import "server-only";
import { psx } from "@/lib/psx/adapter";
import { KSE100_SYMBOL } from "@/lib/constants";

export interface PerfPoint {
  date: string; // YYYY-MM-DD
  value: number; // portfolio market value (PKR)
  benchmark: number; // KSE-100 rebased to the portfolio's starting value
}

interface PositionInput {
  symbol: string;
  quantity: number;
}

/**
 * Build a portfolio equity curve over the last `days` trading days by summing
 * each holding's EOD close × quantity, carrying the last known close forward
 * across gaps. A rebased KSE-100 line is overlaid for benchmarking.
 *
 * In demo mode the candles are deterministic mock data; live mode triggers one
 * EOD fetch per distinct symbol (adapter caches/falls back gracefully).
 */
export async function getPortfolioPerformance(
  positions: PositionInput[],
  days = 120
): Promise<PerfPoint[]> {
  if (positions.length === 0) return [];

  // Fetch candles for each distinct symbol + the benchmark.
  const symbols = Array.from(new Set(positions.map((p) => p.symbol.toUpperCase())));
  const [seriesList, benchCandles] = await Promise.all([
    Promise.all(
      symbols.map(async (s) => ({
        symbol: s,
        byDate: toDateCloseMap(await psx.getEodCandles(s)),
      }))
    ),
    psx.getEodCandles(KSE100_SYMBOL),
  ]);

  const closeBySymbol = new Map(seriesList.map((x) => [x.symbol, x.byDate]));
  const qtyBySymbol = new Map(positions.map((p) => [p.symbol.toUpperCase(), p.quantity]));
  const benchByDate = toDateCloseMap(benchCandles);

  // Union of all dates, ascending.
  const dateSet = new Set<string>();
  for (const { byDate } of seriesList) for (const d of byDate.keys()) dateSet.add(d);
  const allDates = Array.from(dateSet).sort();
  const dates = allDates.slice(-days);

  // last-known close carry-forward per symbol
  const lastClose = new Map<string, number>();
  const points: PerfPoint[] = [];
  let benchLast = 0;
  let startValue = 0;
  let benchStart = 0;

  for (const date of dates) {
    let value = 0;
    for (const sym of symbols) {
      const close = closeBySymbol.get(sym)?.get(date) ?? lastClose.get(sym);
      if (close != null) lastClose.set(sym, close);
      const qty = qtyBySymbol.get(sym) ?? 0;
      value += (lastClose.get(sym) ?? 0) * qty;
    }
    benchLast = benchByDate.get(date) ?? benchLast;

    if (startValue === 0 && value > 0) {
      startValue = value;
      benchStart = benchLast || 1;
    }
    const benchmark =
      benchStart > 0 ? (benchLast / benchStart) * startValue : value;
    points.push({ date, value: round2(value), benchmark: round2(benchmark) });
  }
  return points;
}

function toDateCloseMap(candles: { time: number; close: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of candles) {
    m.set(new Date(c.time * 1000).toISOString().slice(0, 10), c.close);
  }
  return m;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
