"use client";

import * as React from "react";
import {
  Award,
  BarChart3,
  LayoutGrid,
  LayoutList,
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
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { formatPKR } from "@/lib/format";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";
import type { HoldingsStrategyData } from "@/lib/services/market-strategy-holdings";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function CachedMarketStrategyPage() {
  const [view, setView] = React.useState<"detailed" | "simple">("detailed");
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<HoldingsStrategyData>({
      cacheKey: "public:market-strategy-holdings",
      url: "/api/public/market-strategy-holdings",
      refreshInterval: 5 * 60_000,
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
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color="violet"
              label="Refresh returns"
              onRefresh={async () => {
                const result = await refreshNow();
                const count = (result as HoldingsStrategyData | undefined)?.funds?.length;
                return count ? `${count} fund returns updated` : undefined;
              }}
              stages={[
                "Loading fund holdings data",
                "Fetching live PSX prices",
                "Calculating estimated returns",
                "Updating strategy board",
              ]}
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
                  tone={toneOf(data.summary.worst.estimatedReturn)}
                  accent={toneOf(data.summary.worst.estimatedReturn) === "gain" ? "emerald" : "rose"}
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

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              {view === "detailed" ? "Detailed view — grouped by AMC" : "Simple view — all funds at a glance"}
            </p>
            <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setView("detailed")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === "detailed"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutList className="size-3.5" />
                Detailed
              </button>
              <button
                type="button"
                onClick={() => setView("simple")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === "simple"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="size-3.5" />
                Simple
              </button>
            </div>
          </div>

          <MarketStrategyBoard data={data} view={view} />
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
