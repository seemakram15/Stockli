import "server-only";

/**
 * Single source of truth for fund return math (weighted holdings estimate +
 * Rs-on-100k conversion). Used by funds-breakdown, fund detail, and the
 * Fund Daily Returns Report so those screens cannot drift.
 */

export const FUND_INVESTMENT_AMOUNT = 100_000;

export interface HoldingLike {
  symbol: string | null;
  stockName: string;
  percentage: number;
}

export interface QuoteLike {
  changePct: number;
}

export interface FundReturnEstimate {
  /** Weighted-average % return across priced holdings only. Null if nothing priced. */
  returnPct: number | null;
  /** Rs P/L on `investmentAmount` implied by returnPct. Null if returnPct is null. */
  estimatedReturn: number | null;
  /** Sum of weight% for holdings with a symbol and a live price (what returnPct is based on). */
  pricedWeight: number;
  /** Sum of weight% for the catch-all "Other Holdings" row (undisclosed allocations). */
  unknownWeight: number;
  /** Sum of weight% for holdings with a symbol but no live price available right now. */
  missingPriceWeight: number;
  pricedHoldings: number;
  totalHoldings: number;
}

/** Convert a percent return into Rs P/L on a notional investment (default Rs 100k). */
export function profitOnInvestment(
  returnPct: number,
  investmentAmount: number = FUND_INVESTMENT_AMOUNT
): number {
  return (returnPct / 100) * investmentAmount;
}

export function computeFundReturnEstimate(
  holdings: readonly HoldingLike[],
  quoteMap: ReadonlyMap<string, QuoteLike>,
  investmentAmount: number = FUND_INVESTMENT_AMOUNT
): FundReturnEstimate {
  let weightedReturnSum = 0;
  let pricedWeight = 0;
  let unknownWeight = 0;
  let missingPriceWeight = 0;
  let pricedHoldings = 0;

  for (const h of holdings) {
    const isOther = h.stockName === "Other Holdings" || !h.symbol;
    if (isOther) {
      unknownWeight += h.percentage;
      continue;
    }
    const quote = quoteMap.get(h.symbol!.toUpperCase());
    if (!quote || !Number.isFinite(quote.changePct)) {
      // Soft-fail individual price misses — skip this weight, keep estimating the rest.
      missingPriceWeight += h.percentage;
      continue;
    }
    weightedReturnSum += h.percentage * quote.changePct;
    pricedWeight += h.percentage;
    pricedHoldings++;
  }

  const returnPct = pricedWeight > 0 ? weightedReturnSum / pricedWeight : null;
  const estimatedReturn =
    returnPct != null ? profitOnInvestment(returnPct, investmentAmount) : null;

  return {
    returnPct,
    estimatedReturn,
    pricedWeight,
    unknownWeight,
    missingPriceWeight,
    pricedHoldings,
    totalHoldings: holdings.length,
  };
}
