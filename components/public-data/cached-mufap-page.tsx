"use client";

import { BadgePercent, Layers3 } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { MufapFundsBoard } from "@/components/market/mufap-funds-board";
import { PageHeader } from "@/components/page-header";
import { DataDelayBadge } from "@/components/status-badges";
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

  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
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
        title={
          <span className="flex items-center gap-2">
            <Icon className="size-7 text-primary" />
            {title}
          </span>
        }
        description={description}
        actions={
          <>
            <DataDelayBadge />
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
        <MufapFundsBoard data={data} title={boardTitle} etfMode={etfMode} />
      ) : isLoading ? (
        <PageLoadingState message={`Loading ${title.toLowerCase()}...`} />
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
