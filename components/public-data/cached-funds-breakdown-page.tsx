"use client";

import { PieChart } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { FundsBreakdownBoard } from "@/components/market/funds-breakdown-board";
import { PageHeader } from "@/components/page-header";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { FundsBreakdownData } from "@/lib/services/funds-breakdown";

export function CachedFundsBreakdownPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<FundsBreakdownData>({
      cacheKey: "public:funds-breakdown",
      url: "/api/public/funds-breakdown",
      refreshInterval: 5 * 60_000,
    });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<PieChart />}
        eyebrow="Fund holdings breakdown"
        accent="violet"
        title="Funds Breakdown"
        description="Each fund's stock holdings with live PSX daily change and Rs 100k P/L estimate."
        actions={
          <>
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color="violet"
              label="Refresh holdings"
              onRefresh={async () => {
                await refreshNow();
                return "Holdings data refreshed";
              }}
              stages={[
                "Fetching fund holdings data",
                "Loading live PSX prices",
                "Updating breakdown view",
              ]}
            />
          </>
        }
      />

      {data ? (
        <FundsBreakdownBoard data={data} />
      ) : isLoading ? (
        <PageLoadingState message="Loading fund holdings…" variant="list" />
      ) : (
        <EmptyState
          icon={<PieChart className="size-6" />}
          title="Holdings data unavailable"
          description={
            error?.message ??
            "No published holdings found or prices could not be loaded. Please try again shortly."
          }
        />
      )}
    </div>
  );
}
