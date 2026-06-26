import type {
  AllocationSlice,
  Holding,
  HoldingWithMetrics,
  PortfolioSummary,
  Quote,
  RealizedPositionPL,
  Ticker,
  Transaction,
} from "@/lib/types";

/** Enrich a raw holding with its live quote + computed P/L metrics. */
export function computeHoldingMetrics(
  holding: Holding | HoldingWithMetrics,
  ticker: Ticker | null,
  quote: Quote | null,
  historicalPLBase?: number | null
): HoldingWithMetrics {
  const price = effectiveQuotePrice(quote) ?? holding.avg_buy_price;
  const marketValue = price * holding.quantity;
  const costBasis = holding.avg_buy_price * holding.quantity;
  const dayChange = (quote?.change ?? 0) * holding.quantity;
  const dayChangePct = quote?.changePct ?? 0;
  const rawUnrealizedPL = marketValue - costBasis;
  const storedHistoricalBase =
    "historicalPLBase" in holding ? holding.historicalPLBase : null;
  const plBase = historicalPLBase ?? storedHistoricalBase ?? null;
  const historicalTotalPL = plBase == null ? null : plBase + dayChange;
  const unrealizedPL = adjustedUnrealizedPL(
    rawUnrealizedPL,
    dayChange,
    historicalTotalPL
  );
  const unrealizedPLPct = costBasis !== 0 ? (unrealizedPL / costBasis) * 100 : 0;

  return {
    ...holding,
    ticker,
    quote,
    livePrice: price,
    marketValue,
    costBasis,
    historicalPLBase: plBase,
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
  const totalPL = sum(holdings.map((h) => h.unrealizedPL));
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

function adjustedUnrealizedPL(
  rawUnrealizedPL: number,
  dayChange: number,
  historicalTotalPL: number | null
): number {
  if (
    historicalTotalPL != null &&
    Math.abs(rawUnrealizedPL) < 0.005 &&
    Math.abs(historicalTotalPL) >= 0.005
  ) {
    return historicalTotalPL;
  }
  // When a seeded/imported holding uses the current quote as its saved cost,
  // the strict cost-basis result is flat even though the position moved today.
  if (Math.abs(rawUnrealizedPL) < 0.005 && Math.abs(dayChange) >= 0.005) {
    return dayChange;
  }
  return rawUnrealizedPL;
}

/** Realized P/L from SELL transactions using moving-average cost basis. */
export function computeRealizedPL(transactions: Transaction[]): number {
  return sum(
    Array.from(deriveHoldingCostStates(transactions).values()).map((s) => s.realizedPL)
  );
}

/** Per-stock realized P/L from SELL transactions using moving-average cost basis. */
export function computeRealizedPositions(transactions: Transaction[]): RealizedPositionPL[] {
  return Array.from(deriveHoldingCostStates(transactions).entries())
    .map(([key, state]) => {
      const [, symbol = key] = key.split(":");
      const realizedPLPct =
        state.realizedCostBasis !== 0
          ? (state.realizedPL / state.realizedCostBasis) * 100
          : 0;
      return {
        symbol,
        quantitySold: state.soldQuantity,
        proceeds: state.realizedProceeds,
        costBasis: state.realizedCostBasis,
        fees: state.realizedFees,
        realizedPL: state.realizedPL,
        realizedPLPct,
        tradesCount: state.sellTrades,
        lastSoldAt: state.lastSoldAt,
      };
    })
    .filter(
      (row) =>
        row.quantitySold > 0 ||
        Math.abs(row.realizedPL) >= 0.005 ||
        row.tradesCount > 0
    )
    .sort((a, b) => {
      const byDate = (b.lastSoldAt ?? "").localeCompare(a.lastSoldAt ?? "");
      if (byDate !== 0) return byDate;
      return Math.abs(b.realizedPL) - Math.abs(a.realizedPL);
    });
}

export interface HoldingCostState {
  quantity: number;
  avgBuyPrice: number;
  realizedPL: number;
  soldQuantity: number;
  realizedCostBasis: number;
  realizedProceeds: number;
  realizedFees: number;
  sellTrades: number;
  lastSoldAt: string | null;
}

export function holdingCostKey(portfolioId: string, symbol: string) {
  return `${portfolioId}:${symbol.toUpperCase()}`;
}

/** Rebuild moving-average cost basis from immutable trade history. */
export function deriveHoldingCostStates(transactions: Transaction[]) {
  const states = new Map<string, HoldingCostState>();

  for (const transaction of [...transactions].sort(compareTransactionsAsc)) {
    const key = holdingCostKey(transaction.portfolio_id, transaction.symbol);
    const state =
      states.get(key) ??
      ({
        quantity: 0,
        avgBuyPrice: 0,
        realizedPL: 0,
        soldQuantity: 0,
        realizedCostBasis: 0,
        realizedProceeds: 0,
        realizedFees: 0,
        sellTrades: 0,
        lastSoldAt: null,
      } satisfies HoldingCostState);

    applyCostTransaction(state, transaction);
    states.set(key, state);
  }

  return states;
}

function applyCostTransaction(state: HoldingCostState, transaction: Transaction) {
  const quantity = Number(transaction.quantity ?? 0);
  const price = Number(transaction.price ?? 0);
  const fees = Number(transaction.fees ?? 0);

  if (transaction.type === "BUY" || transaction.type === "ADD") {
    const nextQty = state.quantity + quantity;
    if (nextQty <= 0) {
      state.quantity = 0;
      state.avgBuyPrice = 0;
      return;
    }
    const currentCost = state.quantity * state.avgBuyPrice;
    const addedCost = quantity * price + fees;
    state.quantity = nextQty;
    state.avgBuyPrice = (currentCost + addedCost) / nextQty;
    return;
  }

  if (transaction.type === "SELL") {
    const sellQty = Math.min(quantity, Math.max(0, state.quantity));
    if (sellQty > 0) {
      const costBasis = sellQty * state.avgBuyPrice;
      const proceeds = sellQty * price;
      state.realizedCostBasis += costBasis;
      state.realizedProceeds += proceeds;
      state.realizedFees += fees;
      state.realizedPL += proceeds - costBasis - fees;
      state.soldQuantity += sellQty;
      state.sellTrades += 1;
      state.lastSoldAt = transaction.transacted_at;
      state.quantity = Math.max(0, state.quantity - sellQty);
      if (state.quantity === 0) state.avgBuyPrice = 0;
      return;
    }
    state.realizedFees += fees;
    state.realizedPL -= fees;
    state.sellTrades += 1;
    state.lastSoldAt = transaction.transacted_at;
    return;
  }

  if (transaction.type === "REMOVE") {
    state.quantity = 0;
    state.avgBuyPrice = 0;
  }
}

function compareTransactionsAsc(a: Transaction, b: Transaction) {
  const byDate = a.transacted_at.localeCompare(b.transacted_at);
  if (byDate !== 0) return byDate;
  return a.created_at.localeCompare(b.created_at);
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
  for (const h of holdings) map.set(h.symbol, (map.get(h.symbol) ?? 0) + h.marketValue);
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
