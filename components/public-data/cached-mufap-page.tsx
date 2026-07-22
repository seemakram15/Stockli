"use client";

import { BadgePercent, Layers3 } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { MufapFundsBoard } from "@/components/market/mufap-funds-board";
import { EtfTable } from "@/components/market/etf-table";
import { PageHeader } from "@/components/page-header";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { MufapFundsData } from "@/lib/services/mufap";

export function CachedMufapPage({ kind }: { kind: "mutual" | "etfs" }) {
  const etfMode = kind === "etfs";
  const title = etfMode ? "Exchange Traded Funds" : "Mutual Funds";
  const boardTitle = etfMode ? "MUFAP exchange traded funds" : "MUFAP mutual funds";
  const description = etfMode
    ? "MUFAP ETF NAVs, returns, AMC filters and Rs 100,000 performance view."
    : "MUFAP daily NAV, returns, AMC filters and Rs 100,000 performance view.";
  const Icon = etfMode ? Layers3 : BadgePercent;

  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<MufapFundsData>({
      cacheKey: `public:mufap:${kind}`,
      url: `/api/public/mufap?kind=${etfMode ? "etfs" : "mutual"}`,
      refreshInterval: 5 * 60_000,
      pauseWhen: () => !shouldRefreshPsxData(),
      acceptCacheWhen: () => !shouldRefreshPsxData(),
    });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<Icon />}
        eyebrow={etfMode ? "Exchange traded funds" : "Mutual funds"}
        accent="amber"
        title={title}
        description={description}
        actions={
          <>
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color="amber"
              label={etfMode ? "Refresh ETFs" : "Refresh funds"}
              onRefresh={async () => {
                const result = await refreshNow();
                const count = (result as MufapFundsData | undefined)?.funds?.length;
                return count ? `${count} ${etfMode ? "ETFs" : "funds"} updated` : undefined;
              }}
              stages={[
                "Connecting to MUFAP",
                "Fetching latest NAV data",
                etfMode ? "Processing ETF returns" : "Processing fund returns",
                "Updating fund board",
              ]}
            />
          </>
        }
      />

      {data ? (
        etfMode ? (
          <EtfTable data={data} />
        ) : (
          <MufapFundsBoard data={data} title={boardTitle} etfMode={etfMode} />
        )
      ) : isLoading ? (
        <PageLoadingState message={`Loading ${title.toLowerCase()}...`} variant="list" />
      ) : (
        <EmptyState
          icon={<Icon className="size-6" />}
          title={`${title} unavailable`}
          description={
            error?.message ??
            "The saved cache is empty and fresh data could not be loaded. Please try again shortly."
          }
        />
      )}
    </div>
  );
}
