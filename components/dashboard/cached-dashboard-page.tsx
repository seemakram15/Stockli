"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Maximize2,
  Minimize2,
  Plus,
  Wallet,
} from "lucide-react";
import { AllocationExplorer, AllocationExpandDialog } from "@/components/dashboard/allocation-explorer";
import { IndexTickerStrip } from "@/components/dashboard/index-ticker-strip";
import { ManualDataRefreshButton } from "@/components/dashboard/manual-data-refresh-button";
import { TopHoldingsByShares } from "@/components/dashboard/top-holdings-by-shares";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { LiveSummaryCards } from "@/components/live-summary-cards";
import { PageHeader } from "@/components/page-header";
import { MarketStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { formatPKR, formatPercent, plColorClass } from "@/lib/format";
import type { DashboardPageData } from "@/lib/services/dashboard-page";
import type { HoldingWithMetrics } from "@/lib/types";

const DASHBOARD_URL = "/api/private/dashboard";
type PerformanceRange = "1D" | "1W" | "1M" | "3M";
const PERFORMANCE_RANGES: Array<{
  value: PerformanceRange;
  label: string;
}> = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
];

export function CachedDashboardPage({ userId }: { userId: string }) {
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const {
    data,
    error,
    isLoading,
    isRefreshing,
    isFromDeviceCache,
    lastCachedAt,
    refreshNow,
  } = usePersistentResource<DashboardPageData>({
    cacheKey: `private:dashboard:${userId}`,
    url: DASHBOARD_URL,
    refreshInterval: 60_000,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: cacheClosedOnly,
  });

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageLoadingState
          message={isLoading ? "Loading dashboard..." : "Preparing dashboard..."}
        />
      </div>
    );
  }

  const { dashboard, headlineTicker, tickerItems, calendar, performance, market } = data;
  const { summary, holdings, portfolios } = dashboard;
  const liveCalendarPositions = holdings.map((holding) => ({
    symbol: holding.symbol,
    quantity: holding.quantity,
    initial: holding.quote,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your positions across all portfolios, at a glance."
        actions={
          <>
            <MarketStatusBadge status={market.status} label={market.label} />
            <ManualDataRefreshButton onDashboardRefresh={refreshNow} cachedAt={lastCachedAt} />
            <Button asChild size="sm">
              <Link href="/portfolios">
                <Plus className="size-4" /> Manage
              </Link>
            </Button>
          </>
        }
      />

      <DashboardCacheBadge
        cachedAt={lastCachedAt}
        isFromDeviceCache={isFromDeviceCache}
        isRefreshing={isRefreshing}
      />
      {error && data && (
        <p className="text-xs text-muted-foreground">
          Live refresh is unavailable right now, so the last dashboard view is still shown.
        </p>
      )}

      <IndexTickerStrip headline={headlineTicker} items={tickerItems} />

      {holdings.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No holdings yet"
          description="Create a portfolio and add your first PSX position to see live P/L, charts and your daily gain/loss calendar."
          action={
            <Button asChild>
              <Link href="/portfolios">
                <Plus className="size-4" /> Create a portfolio
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <LiveSummaryCards holdings={holdings} realizedPL={summary.realizedPL} />

          <div className="grid gap-4 lg:grid-cols-3">
            <PerformanceCard data={performance} holdings={holdings} />
            <AllocationExplorer holdings={holdings} portfolios={portfolios} title="Allocation overview" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <MoversCard title="Top performers" icon="up" items={dashboard.topGainers} />
            <MoversCard title="Lagging positions" icon="down" items={dashboard.topLosers} />
          </div>

          <Card className="relative">
            <CardHeader className="flex-col items-start gap-2 pr-16 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-5 text-primary" />
                <div>
                  <CardTitle>All portfolios gain / loss calendar</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Daily PKR gain/loss across every portfolio, with today updated from live session prices.
                  </p>
                </div>
              </div>
              <AllocationExpandDialog
                holdings={holdings}
                portfolios={portfolios}
                description="Explore exposure, invested amount and live P/L across all portfolios."
                ariaLabel="Expand portfolio allocation"
                triggerClassName="absolute right-4 top-4 z-10 size-9 border-primary/30 bg-primary/5 text-primary shadow-sm hover:bg-primary/10"
              />
            </CardHeader>
            <CardContent>
              <PLCalendar
                data={calendar?.days ?? []}
                hasPosition
                livePositions={liveCalendarPositions}
                showSummaryPL={false}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DashboardCacheBadge({
  cachedAt,
  isFromDeviceCache,
  isRefreshing,
}: {
  cachedAt: string | null;
  isFromDeviceCache: boolean;
  isRefreshing: boolean;
}) {
  if (!cachedAt && !isRefreshing) return null;

  return (
    <div
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-0 z-30 hidden rotate-180 rounded-l-xl border border-r-0 border-border bg-background/90 px-2.5 py-3 text-[11px] text-muted-foreground shadow-lg backdrop-blur [text-orientation:mixed] [writing-mode:vertical-rl] sm:block"
      role="status"
      title={[
        isRefreshing ? "Refreshing dashboard" : "Dashboard cache",
        cachedAt ? `Last cached ${formatCacheTime(cachedAt)}` : null,
        isFromDeviceCache ? "Showing saved data" : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <span className="font-semibold text-foreground">
        {isRefreshing ? "Refreshing dashboard..." : "Dashboard cache"}
      </span>
      {cachedAt ? (
        <span className="mt-2">
          Cached {formatCacheTime(cachedAt)}
          {isFromDeviceCache ? " · showing saved data" : ""}
        </span>
      ) : null}
    </div>
  );
}

function PerformanceCard({
  data,
  holdings,
}: {
  data: DashboardPageData["performance"];
  holdings: HoldingWithMetrics[];
}) {
  const [range, setRange] = React.useState<PerformanceRange>("3M");
  const [expanded, setExpanded] = React.useState(false);
  const filteredData = React.useMemo(() => filterPerformanceData(data, range), [data, range]);

  if (!data) return <PerformanceSkeleton />;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Your Portfolios vs KSE-100 returns</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Compare each day&apos;s KSE-100 return with every Portfolio&apos;s daily return.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="grid grid-cols-4 rounded-xl bg-muted p-1">
            {PERFORMANCE_RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  range === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={expanded ? "Shrink returns chart" : "Stretch returns chart"}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <PerformanceChart data={filteredData} height={expanded ? 460 : 330} />
        <TopHoldingsByShares holdings={holdings} />
      </CardContent>
    </Card>
  );
}

function filterPerformanceData(
  data: DashboardPageData["performance"],
  range: PerformanceRange
): DashboardPageData["performance"] {
  if (!data || data.points.length <= 1) return data;
  if (range === "1D") {
    return { ...data, points: data.points.slice(-1) };
  }

  const latest = parseChartDate(data.points[data.points.length - 1]?.date);
  if (!latest) {
    const fallback = range === "1W" ? 7 : range === "1M" ? 30 : 90;
    return { ...data, points: data.points.slice(-fallback) };
  }

  const cutoff = new Date(latest);
  if (range === "1W") cutoff.setDate(cutoff.getDate() - 7);
  if (range === "1M") cutoff.setMonth(cutoff.getMonth() - 1);
  if (range === "3M") cutoff.setMonth(cutoff.getMonth() - 3);

  const points = data.points.filter((point) => {
    const date = parseChartDate(point.date);
    return date ? date >= cutoff : false;
  });

  return { ...data, points: points.length ? points : data.points.slice(-1) };
}

function parseChartDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function PerformanceSkeleton() {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Your Portfolios vs KSE-100 returns</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-[280px] items-end gap-1.5">
          {Array.from({ length: 28 }).map((_, index) => (
            <Skeleton
              key={index}
              className="flex-1 rounded-sm"
              style={{ height: `${30 + ((index * 37) % 60)}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MoversCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: "up" | "down";
  items: HoldingWithMetrics[];
}) {
  return (
    <Card size="sm" className="min-w-0">
      <CardHeader className="flex-row items-center gap-2">
        {icon === "up" ? (
          <ArrowUpRight className="size-4 text-gain" />
        ) : (
          <ArrowDownRight className="size-4 text-loss" />
        )}
        <CardTitle className="text-sm sm:text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No data.</p>
        )}
        {items.map((holding) => (
          <Link
            key={holding.id}
            href={`/stock/${holding.symbol}`}
            className="block rounded-lg px-1.5 py-1.5 hover:bg-accent/50 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:px-2"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{holding.symbol}</p>
              <p className="text-xs text-muted-foreground">
                {formatPKR(holding.livePrice)}
              </p>
            </div>
            <div className="mt-1 min-w-0 sm:mt-0 sm:text-right">
              <p className={`truncate text-sm font-medium tabular-nums ${plColorClass(holding.dayChange)}`}>
                {formatPKR(holding.dayChange, { sign: true })}
              </p>
              <p className={`text-xs tabular-nums ${plColorClass(holding.dayChangePct)}`}>
                {formatPercent(holding.dayChangePct)}
              </p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function formatCacheTime(value: string | null) {
  if (!value) return "your device";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}
