"use client";

import useSWR from "swr";
import * as React from "react";
import { CLIENT_REFRESH_MS } from "@/lib/constants";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
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
  const [hydrated, setHydrated] = React.useState(false);
  const [localCacheReady, setLocalCacheReady] = React.useState(false);
  const [localCached, setLocalCached] = React.useState<PricesResponse | undefined>();
  const [, setClockTick] = React.useState(0);
  React.useEffect(() => setHydrated(true), []);

  const symbolsKey = React.useMemo(
    () => Array.from(new Set(symbols.map((s) => s.toUpperCase()))).sort().join(","),
    [symbols]
  );
  const key = symbolsKey ? `/api/prices?symbols=${symbolsKey}` : null;
  const cacheKey = symbolsKey ? `stockli:prices:${symbolsKey}` : null;

  const fallbackData: PricesResponse | undefined = initial
    ? { quotes: initial }
    : undefined;
  const shouldRefresh = shouldRefreshPsxData();
  const hasSeedData = Boolean(localCached ?? fallbackData);
  const swrKey =
    key && hydrated && localCacheReady && (shouldRefresh || !hasSeedData) ? key : null;

  React.useEffect(() => {
    setLocalCacheReady(false);
    if (!cacheKey || typeof window === "undefined") {
      setLocalCached(undefined);
      setLocalCacheReady(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(cacheKey);
      setLocalCached(raw ? (JSON.parse(raw) as PricesResponse) : undefined);
    } catch {
      setLocalCached(undefined);
    } finally {
      setLocalCacheReady(true);
    }
  }, [cacheKey]);

  React.useEffect(() => {
    const id = window.setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { data, isLoading } = useSWR<PricesResponse>(swrKey, fetcher, {
    refreshInterval: () => (shouldRefreshPsxData() ? CLIENT_REFRESH_MS : 0),
    revalidateOnFocus: shouldRefresh,
    revalidateOnReconnect: shouldRefresh,
    dedupingInterval: 10_000,
    keepPreviousData: true,
    fallbackData,
  });

  React.useEffect(() => {
    if (!data || !cacheKey || typeof window === "undefined") return;
    setLocalCached(data);
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      /* best effort */
    }
  }, [cacheKey, data]);

  const displayData = hydrated
    ? data ?? (shouldRefresh ? undefined : localCached) ?? fallbackData
    : fallbackData;

  const quotes = React.useMemo(() => {
    const m = new Map<string, Quote>();
    for (const q of displayData?.quotes ?? []) m.set(q.symbol.toUpperCase(), q);
    return m;
  }, [displayData]);

  return { quotes, market: displayData?.market, isLoading: isLoading && !displayData };
}
