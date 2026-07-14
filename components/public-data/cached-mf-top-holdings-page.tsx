"use client";

import * as React from "react";
import { Trophy } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PageHeader } from "@/components/page-header";
import { DataDelayBadge } from "@/components/status-badges";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { identifyAmcBrand } from "@/lib/amc-brands";
import { cn } from "@/lib/utils";
import type { MFTopHoldingsData, MFTopHolding } from "@/lib/services/mf-top-holdings";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function CachedMFTopHoldingsPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<MFTopHoldingsData>({
      cacheKey: "public:mf-top-holdings",
      url: "/api/public/mf-top-holdings",
      refreshInterval: 15 * 60_000,
    });

  const periodLabel =
    data?.periodYear && data?.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  const maxFundCount = data ? Math.max(...data.holdings.map((h) => h.fundCount), 1) : 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<Trophy />}
        eyebrow="Mutual fund holdings"
        accent="amber"
        title="Top Holdings by Mutual Funds"
        description={
          periodLabel
            ? `Stocks ranked by how many mutual funds hold them · ${periodLabel} holdings`
            : "Stocks ranked by the number of mutual funds that disclose a position."
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
        <div className="space-y-2">
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span>{data.holdings.length} stocks tracked across {data.totalFunds} funds</span>
            {periodLabel && <span>· {periodLabel} holdings</span>}
          </div>

          {/* Header row */}
          <div className="hidden grid-cols-[2rem_1fr_6rem_5rem_5rem_5rem] items-center gap-4 px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>#</span>
            <span>Stock</span>
            <span className="text-center">Funds</span>
            <span className="text-center">AMCs</span>
            <span className="text-right">Avg wt.</span>
            <span className="text-right">Change</span>
          </div>

          {data.holdings.map((holding, index) => (
            <HoldingRow
              key={holding.symbol}
              holding={holding}
              rank={index + 1}
              maxFundCount={maxFundCount}
            />
          ))}
        </div>
      ) : isLoading ? (
        <PageLoadingState message="Loading top holdings by mutual funds..." variant="list" />
      ) : (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="Holdings data unavailable"
          description={
            error?.message ??
            "No published holdings found. Please try again shortly."
          }
        />
      )}
    </div>
  );
}

function HoldingRow({
  holding,
  rank,
  maxFundCount,
}: {
  holding: MFTopHolding;
  rank: number;
  maxFundCount: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const barWidth = `${Math.max(4, (holding.fundCount / maxFundCount) * 100)}%`;
  const changePct = holding.changePct;
  const isGain = changePct !== null && changePct > 0;
  const isLoss = changePct !== null && changePct < 0;

  const rankColor =
    rank === 1
      ? "text-amber-500"
      : rank === 2
      ? "text-slate-400"
      : rank === 3
      ? "text-amber-700"
      : "text-muted-foreground";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="grid w-full grid-cols-[2.5rem_1fr] items-center gap-2 px-3 py-3 text-left sm:grid-cols-[2rem_1fr_6rem_5rem_5rem_5rem] sm:gap-4"
      >
        {/* Rank */}
        <span className={cn("text-sm font-bold tabular-nums", rankColor)}>
          {rank}
        </span>

        {/* Symbol + name + bar */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{holding.symbol}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              {holding.stockName}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-500/80"
              style={{ width: barWidth }}
            />
          </div>
          {/* Mobile-only secondary info */}
          <div className="mt-1 flex items-center gap-3 sm:hidden">
            <span className="text-xs text-muted-foreground">{holding.stockName}</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
              <span className="size-2 rounded-full bg-amber-500/80" />
              {holding.fundCount} funds
            </span>
            {changePct !== null && (
              <span className={cn("text-xs font-semibold tabular-nums", isGain ? "text-gain" : isLoss ? "text-loss" : "")}>
                {changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Fund count */}
        <div className="hidden sm:block text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-sm font-bold text-amber-600 dark:text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-500" />
            {holding.fundCount}
          </span>
        </div>

        {/* AMC count */}
        <div className="hidden text-center text-sm tabular-nums text-muted-foreground sm:block">
          {holding.amcCount} AMC{holding.amcCount !== 1 ? "s" : ""}
        </div>

        {/* Avg weight */}
        <div className="hidden text-right text-sm tabular-nums sm:block">
          {holding.avgWeight.toFixed(1)}%
        </div>

        {/* Change % */}
        <div className={cn("hidden text-right text-sm font-semibold tabular-nums sm:block",
          isGain ? "text-gain" : isLoss ? "text-loss" : "text-muted-foreground"
        )}>
          {changePct !== null
            ? `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%`
            : "—"}
        </div>
      </button>

      {/* Expanded fund list */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-3 pb-3 pt-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {holding.fundCount} fund{holding.fundCount !== 1 ? "s" : ""} holding {holding.symbol}
          </p>
          <div className="space-y-1">
            {holding.funds.map((fund) => {
              const brand = identifyAmcBrand(fund.amc);
              return (
                <div
                  key={`${fund.amc}||${fund.fundName}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{fund.fundName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{fund.amcShort}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {fund.percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
