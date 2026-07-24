"use client";

import { PieChart } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { FundsBreakdownBoard } from "@/components/market/funds-breakdown-board";
import { PageHeader } from "@/components/page-header";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { withFreshParam } from "@/lib/hooks/use-refresh-runner";
import type { FundsBreakdownData } from "@/lib/services/funds-breakdown";

export function CachedFundsBreakdownPage() {
  const { data, error, isLoading, refreshNow } =
    usePersistentResource<FundsBreakdownData>({
      cacheKey: "public:funds-breakdown:v2",
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
            <MarketRefreshButton
              color="violet"
              label="Refresh holdings"
              title="Refreshing funds breakdown"
              onRefresh={async () => {
                const result = await refreshNow({
                  url: withFreshParam("/api/public/funds-breakdown"),
                });
                const count = result?.funds?.length;
                return count
                  ? `${count} funds updated with live PSX prices`
                  : "Holdings snapshot refreshed";
              }}
              stages={[
                "Fetching fund holdings + live PSX prices",
                "Updating breakdown view",
              ]}
            />
          </>
        }
      />

      {data && data.funds.length > 0 ? (
        <FundsBreakdownBoard data={data} />
      ) : isLoading ? (
        <PageLoadingState message="Loading fund holdings…" variant="list" />
      ) : (
        <EmptyState
          icon={<PieChart className="size-6" />}
          title="Holdings data unavailable"
          description={
            error?.message ??
            "No published holdings found or prices could not be loaded. Publish fund holdings in admin, or try refresh again shortly."
          }
        />
      )}
    </div>
  );
}
