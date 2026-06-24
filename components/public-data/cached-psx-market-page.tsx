"use client";

import { TrendingUp } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { ConstituentsTable } from "@/components/market/constituents-table";
import { IndicesPanel } from "@/components/market/indices-panel";
import { MarketAccordion } from "@/components/market/market-accordion";
import { MarketPerformers } from "@/components/market/market-performers";
import { SectorPerformancePanel } from "@/components/market/sector-performance";
import { PageHeader } from "@/components/page-header";
import { MarketStatusBadge } from "@/components/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { PublicMarketPageData } from "@/lib/services/public-market-page";

export function CachedPsxMarketPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<PublicMarketPageData>({
      cacheKey: "public:psx-market",
      url: "/api/public/market",
      refreshInterval: 60_000,
    });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Pakistan Stock Exchange"
        description="Live PSX indices, constituents, market performers and sector performance."
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
          </>
        }
      />

      {data ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Market Overview</h2>
            {data.detail ? (
              <IndicesPanel cards={data.cards} initialDetail={data.detail} />
            ) : (
              <EmptyState
                icon={<TrendingUp className="size-6" />}
                title="Index data unavailable"
                description="The PSX feed is temporarily unreachable. Please try again shortly."
              />
            )}
          </section>

          <MarketAccordion title="Market Performers">
            <MarketPerformers data={data.analytics.performers} showHeader={false} />
          </MarketAccordion>

          {data.detail && (
            <MarketAccordion
              title={`${data.detail.symbol} constituents (${data.detail.constituents.length})`}
              meta="Sorted by index weight"
            >
              <Card>
                <CardContent>
                  <ConstituentsTable constituents={data.detail.constituents} />
                </CardContent>
              </Card>
            </MarketAccordion>
          )}

          <MarketAccordion title="Sector Performance">
            <SectorPerformancePanel data={data.analytics.sectors} showHeader={false} />
          </MarketAccordion>
        </>
      ) : isLoading ? (
        <PageLoadingState message="Loading market data..." />
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
