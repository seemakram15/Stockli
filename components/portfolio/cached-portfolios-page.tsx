"use client";

import * as React from "react";
import { Briefcase } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PageHeader } from "@/components/page-header";
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog";
import { LivePortfolioGrid } from "@/components/portfolio/live-portfolio-grid";
import { MarketStatusBadge } from "@/components/status-badges";
import {
  usePersistentResource,
  type CachedRecord,
} from "@/lib/hooks/use-persistent-resource";
import {
  isPortfolioCacheFresh,
  PORTFOLIO_MUTATION_EVENT,
} from "@/lib/cache/portfolio-mutations";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { PortfoliosPageData } from "@/lib/services/portfolios-page";

export function CachedPortfoliosPage() {
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const acceptPortfolioCache = React.useCallback(
    (record: CachedRecord<PortfoliosPageData>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record),
    [cacheClosedOnly]
  );
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<PortfoliosPageData>({
      cacheKey: "private:portfolios",
      url: "/api/private/portfolios",
      refreshInterval: 60_000,
      pauseWhen: cacheClosedOnly,
      acceptCacheWhen: acceptPortfolioCache,
    });

  React.useEffect(() => {
    const onMutation = () => {
      void refreshNow();
    };
    window.addEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
    return () => window.removeEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
  }, [refreshNow]);

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl">
        {isLoading ? (
          <PageLoadingState message="Loading portfolios..." />
        ) : (
          <EmptyState
            icon={<Briefcase className="size-6" />}
            title="Portfolios unavailable"
            description={
              error?.message ??
              "The saved cache is empty and fresh portfolio data could not be loaded."
            }
            action={<CreatePortfolioDialog />}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Portfolios"
        description="Group your positions and track each one's performance."
        actions={
          <>
            <MarketStatusBadge status={data.market.status} label={data.market.label} />
            <CacheStatusBadge
              updatedAt={data.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <CreatePortfolioDialog />
          </>
        }
      />

      {error ? (
        <p className="text-xs text-muted-foreground">
          Live refresh is unavailable right now, so the last portfolio list is still shown.
        </p>
      ) : null}

      {data.portfolios.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-6" />}
          title="No portfolios yet"
          description="Create your first portfolio to start adding holdings."
          action={<CreatePortfolioDialog />}
        />
      ) : (
        <LivePortfolioGrid portfolios={data.portfolios} holdings={data.holdings} />
      )}
    </div>
  );
}
