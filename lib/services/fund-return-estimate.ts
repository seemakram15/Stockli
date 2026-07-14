import "server-only";

/**
 * Single source of truth for "estimated fund return from published holdings"
 * — used by both /market/strategy and /market/funds-breakdown so the two
 * pages can never independently drift on the same underlying data.
 */

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

export function computeFundReturnEstimate(
  holdings: readonly HoldingLike[],
  quoteMap: ReadonlyMap<string, QuoteLike>,
  investmentAmount: number
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
    if (!quote) {
      missingPriceWeight += h.percentage;
      continue;
    }
    weightedReturnSum += h.percentage * quote.changePct;
    pricedWeight += h.percentage;
    pricedHoldings++;
  }

  const returnPct = pricedWeight > 0 ? weightedReturnSum / pricedWeight : null;
  const estimatedReturn = returnPct != null ? (returnPct / 100) * investmentAmount : null;

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
