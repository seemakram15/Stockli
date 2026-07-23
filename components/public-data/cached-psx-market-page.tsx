"use client";

import * as React from "react";
import { Activity, Landmark, Layers, TrendingUp } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { ViewportLazy } from "@/components/loading/viewport-lazy";
import { ConstituentsTable } from "@/components/market/constituents-table";
import { IndicesPanel } from "@/components/market/indices-panel";
import { MarketAccordion } from "@/components/market/market-accordion";
import { MarketPerformers } from "@/components/market/market-performers";
import { PageHeader } from "@/components/page-header";
import { MarketStatusBadge } from "@/components/status-badges";
import { IconChip } from "@/components/ui/accent";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistentResource, writePersistentResourceCache } from "@/lib/hooks/use-persistent-resource";
import { isClosedMarketSnapshotCurrent } from "@/lib/cache/portfolio-mutations";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { PublicMarketPageData } from "@/lib/services/public-market-page";

export function CachedPsxMarketPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<PublicMarketPageData>({
      cacheKey: "public:psx-market:v3",
      url: "/api/public/market",
      refreshInterval: 60_000,
      pauseWhen: () => !shouldRefreshPsxData(),
      acceptCacheWhen: (record) =>
        !shouldRefreshPsxData() && isClosedMarketSnapshotCurrent(record),
      legacyCacheKeys: ["public:psx-market", "public:psx-market:v2"],
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
              title="Refreshing PSX market"
              description="Force-scrapes live PSX prices and indexes, clears stale page caches, then rebuilds this board."
              jobs={[
                {
                  id: "scrape",
                  label: "Scraping live PSX prices & indexes",
                  detail: "Clears mid-session snapshots before pulling the delayed feed",
                  critical: true,
                  run: async () => {
                    const response = await fetch("/api/public/market?fresh=1", {
                      cache: "no-store",
                    });
                    if (!response.ok) throw new Error(`PSX refresh failed (${response.status})`);
                    const json = (await response.json()) as { data?: PublicMarketPageData };
                    if (!json.data) throw new Error("PSX response did not include data");
                    await writePersistentResourceCache("public:psx-market:v3", json.data);
                    return `${json.data.cards.length} indexes loaded`;
                  },
                },
                {
                  id: "apply",
                  label: "Updating this market board",
                  detail: "Writing the fresh snapshot onto this screen",
                  run: async () => {
                    const next = await refreshNow();
                    return next.detail
                      ? `${next.detail.symbol} ${next.detail.change >= 0 ? "+" : ""}${next.detail.change.toFixed(2)}`
                      : "Market board updated";
                  },
                },
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

          <ViewportLazy
            minHeight={280}
            fallback={
              <div className="space-y-3 rounded-xl border border-border p-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            }
          >
            <MarketAccordion title="Market Performers" icon={<Activity />} accent="emerald">
              <MarketPerformers data={data.analytics.performers} showHeader={false} />
            </MarketAccordion>
          </ViewportLazy>

          {activeDetail && (
            <ViewportLazy
              minHeight={320}
              fallback={
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <Skeleton className="h-5 w-56" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              }
            >
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
            </ViewportLazy>
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
