"use client";

import {
  Award,
  BarChart3,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { MarketStrategyBoard } from "@/components/market/market-strategy-board";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DataDelayBadge } from "@/components/status-badges";
import { formatPKR } from "@/lib/format";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { HoldingsStrategyData } from "@/lib/services/market-strategy-holdings";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function CachedMarketStrategyPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<HoldingsStrategyData>({
      cacheKey: "public:market-strategy-holdings",
      url: "/api/public/market-strategy-holdings",
      refreshInterval: 5 * 60_000,
      pauseWhen: () => !shouldRefreshPsxData(),
      acceptCacheWhen: () => !shouldRefreshPsxData(),
    });

  const periodLabel =
    data?.periodYear && data?.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<Target />}
        eyebrow="Fund holdings estimate"
        accent="violet"
        title="Fund Returns from Stock Holdings"
        description={
          periodLabel
            ? `Estimated returns for Rs 100k — based on ${periodLabel} holdings × today's PSX prices.`
            : "Estimated stock fund returns from published holdings × live PSX prices."
        }
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
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Total funds"
              value={String(data.summary.totalFunds)}
              tone="default"
              accent="violet"
              icon={<BarChart3 className="size-4" />}
              sub={
                periodLabel ? (
                  <span className="text-muted-foreground">{periodLabel} holdings</span>
                ) : undefined
              }
            />
            <StatCard
              label="Avg Rs 100k est."
              value={formatPKR(data.summary.avgEstimatedReturn, { sign: true })}
              tone={toneOf(data.summary.avgEstimatedReturn)}
              accent="violet"
              icon={<Target className="size-4" />}
            />
            <StatCard
              label="Gainers"
              value={String(data.summary.positiveCount)}
              tone="gain"
              accent="emerald"
              icon={<TrendingUp className="size-4" />}
            />
            <StatCard
              label="Losers"
              value={String(data.summary.negativeCount)}
              tone="loss"
              accent="rose"
              icon={<TrendingDown className="size-4" />}
            />
          </div>

          {data.summary.best && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <StatCard
                label="Best fund"
                value={formatPKR(data.summary.best.estimatedReturn, { sign: true })}
                tone="gain"
                accent="emerald"
                icon={<Award className="size-4" />}
                sub={
                  <span className="truncate text-muted-foreground">
                    {data.summary.best.fundName}
                  </span>
                }
              />
              {data.summary.worst && (
                <StatCard
                  label="Worst fund"
                  value={formatPKR(data.summary.worst.estimatedReturn, { sign: true })}
                  tone="loss"
                  accent="rose"
                  icon={<TrendingDown className="size-4" />}
                  sub={
                    <span className="truncate text-muted-foreground">
                      {data.summary.worst.fundName}
                    </span>
                  }
                />
              )}
            </div>
          )}

          <MarketStrategyBoard data={data} />
        </>
      ) : isLoading ? (
        <PageLoadingState message="Loading fund holdings estimate…" variant="strategy" />
      ) : (
        <EmptyState
          icon={<Target className="size-6" />}
          title="Holdings estimate unavailable"
          description={
            error?.message ??
            "No published holdings data found, or prices could not be loaded. Please try again shortly."
          }
        />
      )}
    </div>
  );
}

function toneOf(value: number | null | undefined): "gain" | "loss" | "default" {
  if (value == null || Number.isNaN(value)) return "default";
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "default";
}
