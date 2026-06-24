"use client";

import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { GlobalMarketBoard } from "@/components/market/global-market-board";
import { PageHeader } from "@/components/page-header";
import { DataDelayBadge } from "@/components/status-badges";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { GlobalMarketData, MarketUniverse } from "@/lib/services/global-markets";

export function CachedGlobalMarketPage({
  market,
  title,
  description,
}: {
  market: MarketUniverse;
  title: string;
  description: string;
}) {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<GlobalMarketData>({
      cacheKey: `public:global-market:${market}`,
      url: `/api/public/global-market/${market}`,
      refreshInterval: market === "crypto" ? 60_000 : 2 * 60_000,
    });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={data?.title ?? title}
        description={data?.description ?? description}
        actions={
          <>
            <DataDelayBadge />
            <CacheStatusBadge
              updatedAt={latestUpdatedAt(data)}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
          </>
        }
      />

      {data ? (
        <GlobalMarketBoard data={data} showMap={market === "world"} />
      ) : isLoading ? (
        <PageLoadingState message={`Loading ${title}...`} />
      ) : (
        <EmptyState
          title={`${title} unavailable`}
          description={
            error?.message ??
            "The saved cache is empty and fresh market data could not be loaded. Please try again shortly."
          }
        />
      )}
    </div>
  );
}

function latestUpdatedAt(data: GlobalMarketData | null) {
  return data?.quotes
    .map((quote) => quote.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}
