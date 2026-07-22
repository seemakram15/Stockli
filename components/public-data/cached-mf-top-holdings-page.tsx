"use client";

import * as React from "react";
import { Trophy, ChevronDown } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PageHeader } from "@/components/page-header";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { withFreshParam } from "@/lib/hooks/use-refresh-runner";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import { IslamicTag, isIslamicOrShariahName } from "@/components/market/islamic-mark";
import { StockIdentity } from "@/components/stock/stock-identity";
import { identifyAmcBrand } from "@/lib/amc-brands";
import { cn } from "@/lib/utils";
import type { MFTopHoldingsData, MFTopHolding, TopHoldingFund } from "@/lib/services/mf-top-holdings";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface AmcGroup {
  amc: string;
  fullName: string;
  color: string;
  totalPct: number;
  funds: TopHoldingFund[];
}

function groupByAmc(funds: TopHoldingFund[]): AmcGroup[] {
  const map = new Map<string, AmcGroup>();
  for (const fund of funds) {
    const brand = identifyAmcBrand(fund.amc);
    if (!map.has(fund.amc)) {
      map.set(fund.amc, { amc: fund.amc, fullName: brand.fullName, color: brand.color, totalPct: 0, funds: [] });
    }
    const group = map.get(fund.amc)!;
    group.totalPct += fund.percentage;
    group.funds.push(fund);
  }
  return Array.from(map.values()).sort((a, b) => b.totalPct - a.totalPct);
}

function HoldingCard({ holding, rank }: { holding: MFTopHolding; rank: number }) {
  const [stockOpen, setStockOpen] = React.useState(false);
  const [openAmcs, setOpenAmcs] = React.useState<Set<string>>(new Set());
  const amcGroups = React.useMemo(() => groupByAmc(holding.funds), [holding.funds]);

  const rankColor =
    rank === 1 ? "text-amber-500" :
    rank === 2 ? "text-slate-400" :
    rank === 3 ? "text-amber-700" :
    "text-muted-foreground";

  function toggleAmc(amc: string) {
    setOpenAmcs((prev) => {
      const next = new Set(prev);
      if (next.has(amc)) next.delete(amc);
      else next.add(amc);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setStockOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <span className={cn("w-6 shrink-0 text-sm font-bold tabular-nums", rankColor)}>{rank}</span>
        <div className="min-w-0 flex-1">
          <StockIdentity
            symbol={holding.symbol}
            name={holding.stockName}
            size="sm"
            className="min-w-0"
          />
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
          <span className="size-1.5 rounded-full bg-amber-500" />
          {holding.fundCount}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", stockOpen && "rotate-180")} />
      </button>

      {stockOpen && (
        <div className="space-y-1 border-t border-border px-2 pb-2 pt-1.5">
          {amcGroups.map((group) => (
            <div key={group.amc} className="overflow-hidden rounded-lg">
              <button
                type="button"
                onClick={() => toggleAmc(group.amc)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-[filter] hover:brightness-95"
                style={{ borderLeft: `3px solid ${group.color}`, backgroundColor: `${group.color}18` }}
              >
                <AmcBrandMark label={group.amc} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{group.fullName}</span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: group.color }}
                >
                  {group.totalPct.toFixed(1)}%
                </span>
                <ChevronDown
                  className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", openAmcs.has(group.amc) && "rotate-180")}
                />
              </button>
              {openAmcs.has(group.amc) && (
                <div className="ml-3 mt-0.5 space-y-0.5">
                  {group.funds.map((fund) => {
                    const islamic = isIslamicOrShariahName(fund.fundName);
                    return (
                    <div
                      key={fund.fundName}
                      className="flex items-center gap-2 rounded-md px-3 py-1.5 hover:bg-muted/40"
                    >
                      {islamic ? <IslamicTag className="shrink-0" /> : null}
                      <span className="min-w-0 flex-1 text-xs text-foreground">{fund.fundName}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">{fund.percentage.toFixed(1)}%</span>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CachedMFTopHoldingsPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<MFTopHoldingsData>({
      cacheKey: "public:mf-top-holdings",
      url: "/api/public/mf-top-holdings",
      refreshInterval: 15 * 60_000,
    });

  const periodLabel =
    data?.periodYear && data?.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  const leftHoldings = data?.holdings.filter((_, i) => i % 2 === 0) ?? [];
  const rightHoldings = data?.holdings.filter((_, i) => i % 2 === 1) ?? [];

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
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color="amber"
              label="Refresh holdings"
              title="Refreshing top holdings"
              onRefresh={async () => {
                const result = await refreshNow({
                  url: withFreshParam("/api/public/mf-top-holdings"),
                });
                const count = result?.holdings?.length;
                return count ? `${count} stocks updated` : undefined;
              }}
              stages={[
                "Fetching mutual fund holdings",
                "Ranking by fund count",
                "Updating holdings board",
              ]}
            />
          </>
        }
      />

      {data ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {data.holdings.length} stocks tracked across {data.totalFunds} funds
            {periodLabel && <span> · {periodLabel} holdings</span>}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-3">
              {leftHoldings.map((holding, i) => (
                <HoldingCard key={holding.symbol} holding={holding} rank={i * 2 + 1} />
              ))}
            </div>
            <div className="space-y-3">
              {rightHoldings.map((holding, i) => (
                <HoldingCard key={holding.symbol} holding={holding} rank={i * 2 + 2} />
              ))}
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <PageLoadingState message="Loading top holdings by mutual funds..." variant="list" />
      ) : (
        <EmptyState
          icon={<Trophy className="size-6" />}
          title="Holdings data unavailable"
          description={error?.message ?? "No published holdings found. Please try again shortly."}
        />
      )}
    </div>
  );
}
