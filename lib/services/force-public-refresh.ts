import "server-only";
import { invalidateStaleCache } from "@/lib/cache/stale";
import { refreshIndexSummaries } from "@/lib/services/history";
import { forceRefreshMarketWatch } from "@/lib/services/prices";

/**
 * Server-side cache bust for public screens. Call when `?fresh=1` so manual /
 * page refresh buttons cannot keep serving a mid-session snapshot.
 */
export type PublicRefreshTarget =
  | "psx-market"
  | "psx-prices"
  | "mufap-mutual"
  | "mufap-etfs"
  | "market-strategy"
  | "market-strategy-holdings"
  | "funds-breakdown"
  | "mf-top-holdings"
  | "fipi-lipi"
  | "youtubers"
  | "board-meetings"
  | "book-closures"
  | "dividend-history"
  | "pivot-points"
  | "pk-commodities"
  | "pk-fuel"
  | `global-market:${string}`;

const CACHE_KEYS: Record<Exclude<PublicRefreshTarget, `global-market:${string}`>, string[]> = {
  "psx-market": ["public-page:psx-market:v3"],
  "psx-prices": [],
  "mufap-mutual": ["mufap:funds:mutual"],
  "mufap-etfs": ["mufap:funds:etfs"],
  "market-strategy": ["market-strategy:stock-funds"],
  "funds-breakdown": ["market:funds-breakdown-v2", "market:mf-top-holdings-v2"],
  "mf-top-holdings": ["market:mf-top-holdings-v2", "market:funds-breakdown-v2"],
  "market-strategy-holdings": [
    "market-strategy:holdings-v2",
    "market:funds-breakdown-v2",
  ],
  "fipi-lipi": ["market:fipi-lipi-v9"],
  youtubers: ["youtube:videos:selected"],
  "board-meetings": ["explore:board-meetings:v4"],
  "book-closures": ["explore:book-closures:v3"],
  "dividend-history": ["explore:dividend-history:v2"],
  "pivot-points": ["analysis:pivot-points:v1"],
  "pk-commodities": ["public:pk-commodities-v12"],
  "pk-fuel": ["public:pk-fuel-prices-v1"],
};

function needsLivePsx(target: PublicRefreshTarget) {
  return (
    target === "psx-market" ||
    target === "psx-prices" ||
    target === "market-strategy" ||
    target === "market-strategy-holdings" ||
    target === "funds-breakdown"
  );
}

function cacheKeysFor(target: PublicRefreshTarget): string[] {
  if (target.startsWith("global-market:")) {
    const market = target.slice("global-market:".length);
    return [`global-market:v6:${market}`];
  }
  return CACHE_KEYS[target as Exclude<PublicRefreshTarget, `global-market:${string}`>] ?? [];
}

export async function forcePublicRefresh(target: PublicRefreshTarget): Promise<{
  psxScraped: boolean;
  cachesCleared: string[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  let psxScraped = false;

  if (needsLivePsx(target)) {
    try {
      await forceRefreshMarketWatch();
      await refreshIndexSummaries();
      psxScraped = true;
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const cachesCleared = cacheKeysFor(target);
  await Promise.all(cachesCleared.map((key) => invalidateStaleCache(key)));

  return { psxScraped, cachesCleared, warnings };
}

export function wantsFresh(request: Request) {
  return new URL(request.url).searchParams.get("fresh") === "1";
}

export function freshCacheHeaders(fresh: boolean, ttlSeconds: number, live: boolean) {
  if (fresh) return { "Cache-Control": "no-store, max-age=0" };
  return {
    "Cache-Control": live
      ? "s-maxage=60, stale-while-revalidate=900"
      : `s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`,
  };
}
