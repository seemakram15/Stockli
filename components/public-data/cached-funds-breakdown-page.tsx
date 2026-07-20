"use client";

import * as React from "react";
import { PieChart, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { FundsBreakdownBoard } from "@/components/market/funds-breakdown-board";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { FundsBreakdownData } from "@/lib/services/funds-breakdown";

export function CachedFundsBreakdownPage() {
  const [refreshing, setRefreshing] = React.useState(false);
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<FundsBreakdownData>({
      cacheKey: "public:funds-breakdown",
      url: "/api/public/funds-breakdown",
      refreshInterval: 5 * 60_000,
    });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshNow();
      toast.success("Funds breakdown updated.");
    } catch {
      toast.error("Could not refresh. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

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
            <Button
              type="button"
              size="sm"
              className="bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-fuchsia-400 hover:text-white hover:shadow-violet-500/35"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RotateCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
              Refresh live data
            </Button>
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
