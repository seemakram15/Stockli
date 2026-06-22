"use client";

import useSWR from "swr";
import * as React from "react";
import { CLIENT_REFRESH_MS } from "@/lib/constants";
import type { Quote } from "@/lib/types";
import type { MarketStatus } from "@/lib/psx/market-hours";

interface PricesResponse {
  quotes: Quote[];
  market?: { status: MarketStatus; label: string };
}

const fetcher = (url: string): Promise<PricesResponse> =>
  fetch(url).then((r) => r.json());

/**
 * Polls /api/prices for the given symbols every ~30s (live-ish, backed by the
 * server's 15-min cache). Seed with server-rendered quotes via `initial` so
 * the first paint has data and there's no flash.
 */
export function usePrices(symbols: string[], initial?: Quote[]) {
  const key =
    symbols.length > 0
      ? `/api/prices?symbols=${Array.from(new Set(symbols.map((s) => s.toUpperCase()))).sort().join(",")}`
      : null;

  const fallbackData: PricesResponse | undefined = initial
    ? { quotes: initial }
    : undefined;

  const { data, isLoading } = useSWR<PricesResponse>(key, fetcher, {
    refreshInterval: CLIENT_REFRESH_MS,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 10_000,
    keepPreviousData: true,
    fallbackData,
  });

  const quotes = React.useMemo(() => {
    const m = new Map<string, Quote>();
    for (const q of data?.quotes ?? []) m.set(q.symbol.toUpperCase(), q);
    return m;
  }, [data]);

  return { quotes, market: data?.market, isLoading };
}
