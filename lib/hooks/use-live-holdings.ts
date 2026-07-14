"use client";

import * as React from "react";
import { usePrices } from "@/lib/hooks/use-prices";
import { isMarketOpen } from "@/lib/psx/market-hours";
import { computeHoldingMetrics } from "@/lib/services/metrics";
import type { HoldingWithMetrics, Quote } from "@/lib/types";

/**
 * Live-quote-enriched holdings. While PSX is open, each holding's price/day
 * change tracks the polled quote; once the market closes, everything freezes
 * to the last server-rendered quote (`h.quote`) for the rest of the session —
 * today's P/L should only move during actual trading hours, never after.
 */
export function useLiveHoldings(holdings: HoldingWithMetrics[]) {
  const symbols = React.useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const initial = React.useMemo(
    () => holdings.map((h) => h.quote).filter(Boolean) as Quote[],
    [holdings]
  );
  const { quotes, isLoading, market } = usePrices(symbols, initial);

  const [, setClockTick] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const marketOpen = isMarketOpen();

  const liveHoldings = React.useMemo(
    () =>
      holdings
        .map((h) =>
          computeHoldingMetrics(
            h,
            h.ticker,
            (marketOpen ? quotes.get(h.symbol.toUpperCase()) : null) ?? h.quote
          )
        )
        .sort((a, b) => b.marketValue - a.marketValue),
    [holdings, quotes, marketOpen]
  );

  return { liveHoldings, isLoading, market };
}
