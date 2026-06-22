"use client";

import * as React from "react";
import { usePrices } from "@/lib/hooks/use-prices";
import { computeHoldingMetrics } from "@/lib/services/metrics";
import type { HoldingWithMetrics, Quote } from "@/lib/types";

export function useLiveHoldings(holdings: HoldingWithMetrics[]) {
  const symbols = React.useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const initial = React.useMemo(
    () => holdings.map((h) => h.quote).filter(Boolean) as Quote[],
    [holdings]
  );
  const { quotes, isLoading, market } = usePrices(symbols, initial);

  const liveHoldings = React.useMemo(
    () =>
      holdings
        .map((h) =>
          computeHoldingMetrics(
            h,
            h.ticker,
            quotes.get(h.symbol.toUpperCase()) ?? h.quote
          )
        )
        .sort((a, b) => b.marketValue - a.marketValue),
    [holdings, quotes]
  );

  return { liveHoldings, isLoading, market };
}
