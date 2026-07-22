"use client";

import * as React from "react";
import { Activity, Landmark, Layers, TrendingUp } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { ConstituentsTable } from "@/components/market/constituents-table";
import { IndicesPanel } from "@/components/market/indices-panel";
import { MarketAccordion } from "@/components/market/market-accordion";
import { MarketPerformers } from "@/components/market/market-performers";
import { PageHeader } from "@/components/page-header";
import { MarketStatusBadge } from "@/components/status-badges";
import { IconChip } from "@/components/ui/accent";
import { Card, CardContent } from "@/components/ui/card";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { PublicMarketPageData } from "@/lib/services/public-market-page";

export function CachedPsxMarketPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<PublicMarketPageData>({
      cacheKey: "public:psx-market",
      url: "/api/public/market",
      refreshInterval: 60_000,
      pauseWhen: () => !shouldRefreshPsxData(),
      acceptCacheWhen: () => !shouldRefreshPsxData(),
    });
  const [currentDetail, setCurrentDetail] = React.useState(data?.detail ?? null);

  React.useEffect(() => {
    const detail = data?.detail;
    if (!detail) return;
    setCurrentDetail((prev) => (!prev || prev.symbol === detail.symbol ? detail : prev));
  }, [data?.detail]);
  const activeDetail = currentDetail ?? data?.detail ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<Landmark />}
        eyebrow="Pakistan Stock Exchange"
        accent="emerald"
        title="Pakistan Stock Exchange"
        description="Live PSX indices, constituents and market performers."
        actions={
          <>
            {data?.market ? (
              <MarketStatusBadge status={data.market.status} label={data.market.label} />
            ) : null}
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color="emerald"
              label="Refresh PSX"
              onRefresh={async () => {
                await refreshNow();
                return "PSX data refreshed";
              }}
              stages={[
                "Connecting to PSX feed",
                "Loading index and sector data",
                "Updating market board",
              ]}
            />
          </>
        }
      />

      {data ? (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2.5">
              <IconChip accent="emerald" variant="gradient" size="sm">
                <TrendingUp />
              </IconChip>
              <h2 className="text-lg font-semibold tracking-tight">Market Overview</h2>
            </div>
            {data.detail ? (
              <IndicesPanel
                cards={data.cards}
                initialDetail={data.detail}
                onDetailChange={setCurrentDetail}
              />
            ) : (
              <EmptyState
                icon={<TrendingUp className="size-6" />}
                title="Index data unavailable"
                description="The PSX feed is temporarily unreachable. Please try again shortly."
              />
            )}
          </section>

          <MarketAccordion title="Market Performers" icon={<Activity />} accent="emerald">
            <MarketPerformers data={data.analytics.performers} showHeader={false} />
          </MarketAccordion>

          {activeDetail && (
            <MarketAccordion
              title={`${activeDetail.symbol} constituents (${activeDetail.constituents.length})`}
              meta="Sorted by index weight"
              icon={<Layers />}
              accent="sky"
            >
              <Card>
                <CardContent>
                  <ConstituentsTable constituents={activeDetail.constituents} />
                </CardContent>
              </Card>
            </MarketAccordion>
          )}
        </>
      ) : isLoading ? (
        <PageLoadingState message="Loading market data..." variant="market" />
      ) : (
        <EmptyState
          icon={<TrendingUp className="size-6" />}
          title="Market data unavailable"
          description={
            error?.message ??
            "The saved cache is empty and fresh PSX market data could not be loaded. Please try again shortly."
          }
        />
      )}
    </div>
  );
}
