import type {
  AllocationSlice,
  Holding,
  HoldingWithMetrics,
  PortfolioSummary,
  Quote,
  Ticker,
  Transaction,
} from "@/lib/types";

/** Enrich a raw holding with its live quote + computed P/L metrics. */
export function computeHoldingMetrics(
  holding: Holding,
  ticker: Ticker | null,
  quote: Quote | null
): HoldingWithMetrics {
  const price = effectiveQuotePrice(quote) ?? holding.avg_buy_price;
  const marketValue = price * holding.quantity;
  const costBasis = holding.avg_buy_price * holding.quantity;
  const unrealizedPL = marketValue - costBasis;
  const unrealizedPLPct = costBasis !== 0 ? (unrealizedPL / costBasis) * 100 : 0;
  const dayChange = (quote?.change ?? 0) * holding.quantity;
  const dayChangePct = quote?.changePct ?? 0;

  return {
    ...holding,
    ticker,
    quote,
    livePrice: price,
    marketValue,
    costBasis,
    unrealizedPL,
    unrealizedPLPct,
    dayChange,
    dayChangePct,
  };
}

export function effectiveQuotePrice(quote: Quote | null): number | null {
  if (!quote) return null;
  const derived =
    quote.ldcp != null && Number.isFinite(quote.change)
      ? quote.ldcp + quote.change
      : null;
  if (derived != null && Number.isFinite(derived) && derived > 0) return derived;
  return Number.isFinite(quote.price) && quote.price > 0 ? quote.price : null;
}

/** Aggregate a set of enriched holdings into a portfolio summary. */
export function computeSummary(
  holdings: HoldingWithMetrics[],
  realizedPL = 0
): PortfolioSummary {
  const totalValue = sum(holdings.map((h) => h.marketValue));
  const totalInvested = sum(holdings.map((h) => h.costBasis));
  const totalPL = totalValue - totalInvested;
  const totalPLPct = totalInvested !== 0 ? (totalPL / totalInvested) * 100 : 0;
  const dayPL = sum(holdings.map((h) => h.dayChange));
  const prevValue = totalValue - dayPL;
  const dayPLPct = prevValue !== 0 ? (dayPL / prevValue) * 100 : 0;

  return {
    totalValue,
    totalInvested,
    totalPL,
    totalPLPct,
    dayPL,
    dayPLPct,
    holdingsCount: holdings.length,
    realizedPL,
  };
}

/** Realized P/L from SELL transactions (uses avg cost recorded on the row). */
export function computeRealizedPL(transactions: Transaction[]): number {
  return sum(
    transactions
      .filter((t) => t.type === "SELL")
      .map((t) => t.quantity * t.price - t.fees)
  );
}

/** Allocation slices by sector. */
export function allocationBySector(holdings: HoldingWithMetrics[]): AllocationSlice[] {
  const total = sum(holdings.map((h) => h.marketValue));
  const bySector = new Map<string, number>();
  for (const h of holdings) {
    const sector = h.ticker?.sector ?? "Other";
    bySector.set(sector, (bySector.get(sector) ?? 0) + h.marketValue);
  }
  return toSlices(bySector, total);
}

/** Allocation slices by individual holding. */
export function allocationByHolding(holdings: HoldingWithMetrics[]): AllocationSlice[] {
  const total = sum(holdings.map((h) => h.marketValue));
  const map = new Map<string, number>();
  for (const h of holdings) map.set(h.symbol, h.marketValue);
  return toSlices(map, total);
}

function toSlices(map: Map<string, number>, total: number): AllocationSlice[] {
  return Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      value,
      pct: total !== 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Weighted-average buy price after adding `addQty` at `addPrice`. */
export function weightedAvgPrice(
  currentQty: number,
  currentAvg: number,
  addQty: number,
  addPrice: number
): number {
  const totalQty = currentQty + addQty;
  if (totalQty <= 0) return 0;
  return (currentQty * currentAvg + addQty * addPrice) / totalQty;
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}
