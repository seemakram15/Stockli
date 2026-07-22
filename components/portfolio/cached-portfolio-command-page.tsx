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
import { AllocationExplorer, AllocationExpandDialog } from "@/components/portfolio/allocation-explorer";
import { IndexTickerStrip } from "@/components/dashboard/index-ticker-strip";
import { ManualDataRefreshButton } from "@/components/dashboard/manual-data-refresh-button";
import { TopHoldingsByShares } from "@/components/dashboard/top-holdings-by-shares";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { ViewportLazy, useViewportEnabled } from "@/components/loading/viewport-lazy";
import { LiveSummaryCards } from "@/components/live-summary-cards";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { PageHeader } from "@/components/page-header";
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog";
import { DataDelayBadge, MarketStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePersistentResource,
  type CachedRecord,
} from "@/lib/hooks/use-persistent-resource";
import {
  isPortfolioCacheFresh,
  PORTFOLIO_MUTATION_EVENT,
} from "@/lib/cache/portfolio-mutations";
import { isMarketOpen, psxLocalDateString, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { formatPKR, formatPercent, plColorClass } from "@/lib/format";
import { StockIdentity } from "@/components/stock/stock-identity";
import type { PortfolioCommandPageData } from "@/lib/services/portfolio-command-page";
import type { PerfPoint, PerformanceResult } from "@/lib/services/performance";
import type { HoldingWithMetrics } from "@/lib/types";

const EMPTY_HOLDINGS: HoldingWithMetrics[] = [];
const PORTFOLIO_COMMAND_URL = "/api/private/portfolio-command";
const PORTFOLIO_PERFORMANCE_URL = "/api/private/portfolio-performance";
const EMPTY_PERF: PerformanceResult = { points: [], series: [] };
type PerformanceGranularity = "1D" | "DAY" | "MONTH" | "YEAR";
type PerformanceWindow = "1M" | "3M" | "1Y" | "3Y" | "5Y" | "10Y" | "ALL";

const PERFORMANCE_GRANULARITIES: Array<{
  value: PerformanceGranularity;
  label: string;
}> = [
  { value: "1D", label: "1D" },
  { value: "DAY", label: "Days" },
  { value: "MONTH", label: "Months" },
  { value: "YEAR", label: "Years" },
];

const PERFORMANCE_WINDOWS: Record<Exclude<PerformanceGranularity, "1D">, Array<{
  value: PerformanceWindow;
  label: string;
}>> = {
  DAY: [
    { value: "1M", label: "1M" },
    { value: "3M", label: "3M" },
    { value: "1Y", label: "1Y" },
    { value: "5Y", label: "5Y" },
    { value: "ALL", label: "All" },
  ],
  MONTH: [
    { value: "1Y", label: "1Y" },
    { value: "3Y", label: "3Y" },
    { value: "5Y", label: "5Y" },
    { value: "10Y", label: "10Y" },
    { value: "ALL", label: "All" },
  ],
  YEAR: [
    { value: "5Y", label: "5Y" },
    { value: "10Y", label: "10Y" },
    { value: "ALL", label: "All" },
  ],
};

const DEFAULT_WINDOW_BY_GRANULARITY: Record<Exclude<PerformanceGranularity, "1D">, PerformanceWindow> = {
  DAY: "3M",
  MONTH: "1Y",
  YEAR: "ALL",
};

export function CachedPortfolioCommandPage({
  userId,
  title = "Portfolio",
  description = "Your positions across all portfolios, at a glance.",
  showManageAction = true,
}: {
  userId: string;
  title?: string;
  description?: string;
  showManageAction?: boolean;
}) {
  const pageLabel = title || "Portfolio";
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const acceptPortfolioCache = React.useCallback(
    (record: CachedRecord<PortfolioCommandPageData>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record, userId),
    [cacheClosedOnly, userId]
  );
  const {
    data,
    error,
    isLoading,
    isRefreshing,
    isFromDeviceCache,
    lastCachedAt,
    refreshNow,
  } = usePersistentResource<PortfolioCommandPageData>({
    cacheKey: `private:portfolio-command:${userId}`,
    url: PORTFOLIO_COMMAND_URL,
    refreshInterval: 60_000,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: acceptPortfolioCache,
  });

  // Performance chart is below the fold — fetch only when near viewport.
  const perfGate = useViewportEnabled({ rootMargin: "280px 0px" });
  const acceptPerfCache = React.useCallback(
    (record: CachedRecord<PerformanceResult>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record, userId),
    [cacheClosedOnly, userId]
  );
  const {
    data: perfData,
    refreshNow: refreshPerf,
  } = usePersistentResource<PerformanceResult>({
    cacheKey: `private:portfolio-performance:${userId}`,
    url: PORTFOLIO_PERFORMANCE_URL,
    refreshInterval: 60_000,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: acceptPerfCache,
    enabled: perfGate.visible,
  });

  React.useEffect(() => {
    const onMutation = () => {
      void refreshNow();
      void refreshPerf();
    };
    window.addEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
    return () => window.removeEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
  }, [refreshNow, refreshPerf]);

  const isFirstDataRef = React.useRef(true);
  React.useEffect(() => {
    if (!data || !perfGate.visible) return;
    if (isFirstDataRef.current) {
      isFirstDataRef.current = false;
      return;
    }
    void refreshPerf();
  }, [data?.updatedAt, perfGate.visible, refreshPerf]);

  // When returning to this page after a mutation (e.g. creating a portfolio from the detail
  // page or any other flow), the SWR dedup window can prevent the automatic revalidation.
  // Detect staleness on mount: if the mutation timestamp is newer than the cached data,
  // force an immediate refresh regardless of SWR's dedup interval.
  const [forceRefreshing, setForceRefreshing] = React.useState(false);
  const staleRefreshTriggeredRef = React.useRef(false);
  React.useEffect(() => {
    if (staleRefreshTriggeredRef.current || !lastCachedAt) return;
    const mutatedAt = window.localStorage.getItem(`stockli:portfolio-mutated-at:${userId}`);
    if (!mutatedAt) return;
    const cacheTime = Date.parse(lastCachedAt);
    const mutationTime = Date.parse(mutatedAt);
    if (Number.isFinite(cacheTime) && Number.isFinite(mutationTime) && cacheTime < mutationTime) {
      staleRefreshTriggeredRef.current = true;
      setForceRefreshing(true);
      void refreshNow().finally(() => setForceRefreshing(false));
    }
  }, [lastCachedAt, userId, refreshNow]);

  const emptyHoldingsRetryRef = React.useRef(false);
  React.useEffect(() => {
    if (emptyHoldingsRetryRef.current || !data) return;
    if (data.dashboard.portfolios.length > 0 && data.dashboard.holdings.length === 0) {
      emptyHoldingsRetryRef.current = true;
      void refreshNow();
    }
  }, [data, refreshNow]);

  // Hooks must run unconditionally, so compute a safe holdings source before
  // the loading-state early return below.
  const { liveHoldings } = useLiveHoldings(data?.dashboard.holdings ?? EMPTY_HOLDINGS);

  if (!data || forceRefreshing) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageLoadingState
          message={isLoading || forceRefreshing ? `Loading ${pageLabel.toLowerCase()}...` : `Preparing ${pageLabel.toLowerCase()}...`}
          variant="portfolio"
        />
      </div>
    );
  }

  const { dashboard, headlineTicker, tickerItems, calendar, market, portfolioDayPL } = data;
  const { summary, holdings, portfolios } = dashboard;
  const hasHoldings = holdings.length > 0;
  const hasPortfolios = portfolios.length > 0;
  const marketOpen = isMarketOpen();
  const lastCalendarDay = calendar?.days.at(-1) ?? null;
  // Only trust the calendar's last day as "today" once its own EOD candle has
  // actually been published for today's date — otherwise it's still
  // yesterday's row, and overriding with it would show yesterday's P/L as if
  // it were today's the moment the market closes (before EOD data catches up).
  const dayPLOverride =
    !marketOpen && lastCalendarDay && lastCalendarDay.date === psxLocalDateString()
      ? { dayPL: lastCalendarDay.dayPL, dayPLPct: lastCalendarDay.dayPLPct }
      : null;
  const liveByHoldingId = new Map(liveHoldings.map((h) => [h.id, h]));
  const liveCalendarPositions = holdings.map((holding) => {
    const live = liveByHoldingId.get(holding.id);
    return {
      symbol: holding.symbol,
      quantity: holding.quantity,
      avgBuyPrice: holding.avg_buy_price,
      initial: holding.quote,
      liveDayChange: live?.dayChange,
      liveMarketValue: live?.marketValue,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <DataDelayBadge />
            <MarketStatusBadge status={market.status} label={market.label} />
            <ManualDataRefreshButton
              userId={userId}
              onDashboardRefresh={refreshNow}
            />
            {showManageAction ? (
              <Button asChild size="sm">
                <Link href="/portfolios">
                  <Plus className="size-4" /> Manage
                </Link>
              </Button>
            ) : (
              <CreatePortfolioDialog
                userId={userId}
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" /> Add portfolio
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <PortfolioCacheBadge
        label={pageLabel}
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

      {!hasHoldings ? (
        <>
          {hasPortfolios ? (
            <PortfolioJumpCards portfolios={portfolios} holdings={holdings} userId={userId} />
          ) : null}
          <EmptyState
            icon={<Wallet className="size-6" />}
            title={hasPortfolios ? "No holdings yet" : "No portfolios yet"}
            description={
              hasPortfolios
                ? "Open a portfolio and add your first trade to see live P/L, charts and your daily gain/loss calendar."
                : "Create your first portfolio, then add your PSX positions to see live P/L, charts and your daily gain/loss calendar."
            }
            action={
              hasPortfolios ? (
                <Button asChild>
                  <Link href={`/portfolios/${portfolios[0].id}`}>
                    Open portfolio
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <CreatePortfolioDialog
                  userId={userId}
                  trigger={
                    <Button>
                      <Plus className="size-4" /> Create a portfolio
                    </Button>
                  }
                />
              )
            }
          />
        </>
      ) : (
        <>
          <LiveSummaryCards
            holdings={holdings}
            liveHoldings={liveHoldings}
            realizedPL={summary.realizedPL}
            dayPLOverride={dayPLOverride}
          />

          <PortfolioJumpCards
            portfolios={portfolios}
            holdings={liveHoldings}
            userId={userId}
            dayPLByPortfolio={marketOpen ? null : portfolioDayPL}
          />

          <div ref={perfGate.ref} className="grid gap-4 lg:grid-cols-3">
            {perfGate.visible ? (
              <PerformanceCard data={perfData} holdings={holdings} />
            ) : (
              <PerformanceSkeleton />
            )}
            <AllocationExplorer holdings={holdings} portfolios={portfolios} title="Allocation overview" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <MoversCard title="Top performers" icon="up" items={dashboard.topGainers} />
            <MoversCard title="Lagging positions" icon="down" items={dashboard.topLosers} />
          </div>

          <ViewportLazy minHeight={420} fallback={<PerformanceSkeleton />}>
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
          </ViewportLazy>
        </>
      )}
    </div>
  );
}

function PortfolioJumpCards({
  portfolios,
  holdings,
  userId,
  dayPLByPortfolio,
}: {
  portfolios: PortfolioCommandPageData["dashboard"]["portfolios"];
  holdings: HoldingWithMetrics[];
  userId: string;
  /** When there's no live session today, each portfolio's own most recent
   *  calendar day — keeps these mini-cards from disagreeing with the
   *  gain/loss calendar once the market's closed. */
  dayPLByPortfolio?: PortfolioCommandPageData["portfolioDayPL"] | null;
}) {
  if (portfolios.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Your portfolio workspaces</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Open any portfolio for trades, holdings, allocation and daily P/L history.
          </p>
        </div>
        <CardAction>
          <CreatePortfolioDialog
            userId={userId}
            trigger={
              <Button size="sm" variant="outline" className="h-9">
                <Plus className="size-4" /> Add portfolio
              </Button>
            }
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
          {portfolios.map((portfolio) => {
            const portfolioHoldings = holdings.filter(
              (holding) => holding.portfolio_id === portfolio.id
            );
            const value = portfolioHoldings.reduce(
              (sum, holding) => sum + holding.livePrice * holding.quantity,
              0
            );
            const override = dayPLByPortfolio?.[portfolio.id];
            const dayPL =
              override?.dayPL ??
              portfolioHoldings.reduce((sum, holding) => sum + holding.dayChange, 0);

            return (
              <Link
                key={portfolio.id}
                href={`/portfolios/${portfolio.id}`}
                className="group rounded-xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{portfolio.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {portfolioHoldings.length} positions
                    </p>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Value</p>
                    <p className="mt-1 font-semibold tabular-nums">{formatPKR(value)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Day P/L</p>
                    <p className={`mt-1 font-semibold tabular-nums ${plColorClass(dayPL)}`}>
                      {formatPKR(dayPL, { sign: true })}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioCacheBadge({
  label,
  cachedAt,
  isFromDeviceCache,
  isRefreshing,
}: {
  label: string;
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
        isRefreshing ? `Refreshing ${label.toLowerCase()}` : `${label} cache`,
        cachedAt ? `Last cached ${formatCacheTime(cachedAt)}` : null,
        isFromDeviceCache ? "Showing saved data" : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <span className="font-semibold text-foreground">
        {isRefreshing ? `Refreshing ${label.toLowerCase()}...` : `${label} cache`}
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
  data: PortfolioCommandPageData["performance"];
  holdings: HoldingWithMetrics[];
}) {
  const [granularity, setGranularity] = React.useState<PerformanceGranularity>("DAY");
  const [window, setWindow] = React.useState<PerformanceWindow>("3M");
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (granularity === "1D") return;
    const allowed = PERFORMANCE_WINDOWS[granularity].map((item) => item.value);
    if (!allowed.includes(window)) {
      setWindow(DEFAULT_WINDOW_BY_GRANULARITY[granularity]);
    }
  }, [granularity, window]);

  const filteredData = React.useMemo(
    () => buildPerformanceView(data ?? EMPTY_PERF, granularity, window),
    [data, granularity, window]
  );
  const rangeOptions = granularity === "1D" ? [] : PERFORMANCE_WINDOWS[granularity];
  const viewDescription = getPerformanceViewDescription(granularity, filteredData.points);

  if (!data) return <PerformanceSkeleton />;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Your Portfolios vs KSE-100 returns</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {viewDescription}
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <div className="grid w-full grid-cols-4 rounded-xl bg-muted p-1 sm:w-auto">
            {PERFORMANCE_GRANULARITIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGranularity(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  granularity === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {rangeOptions.length ? (
              <div className="grid auto-cols-fr grid-flow-col rounded-xl bg-muted p-1">
                {rangeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setWindow(option.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      window === option.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Latest session
              </div>
            )}
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
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <PerformanceChart data={filteredData} height={expanded ? 460 : 330} />
        <TopHoldingsByShares holdings={holdings} />
      </CardContent>
    </Card>
  );
}

function buildPerformanceView(
  data: PerformanceResult,
  granularity: PerformanceGranularity,
  window: PerformanceWindow
): PerformanceResult {
  if (!data || data.points.length <= 1) return data;

  if (granularity === "1D") {
    return {
      ...data,
      points: data.points.slice(-1).map((point) => ({
        ...point,
        label: point.label ?? "Latest session",
        tooltipLabel: point.tooltipLabel ?? formatPointLabel(point.date),
      })),
    };
  }

  if (granularity === "DAY") {
    return {
      ...data,
      points: filterPointsByWindow(
        data.points.map((point) => ({
          ...point,
          label: formatDayAxisLabel(point.date),
          tooltipLabel: formatPointLabel(point.date),
        })),
        window
      ),
    };
  }

  const aggregated = aggregatePerformancePoints(data, granularity === "MONTH" ? "month" : "year");
  return {
    ...data,
    points: filterPointsByWindow(aggregated, window),
  };
}

function parseChartDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filterPointsByWindow(points: PerfPoint[], window: PerformanceWindow) {
  if (window === "ALL" || points.length <= 1) return points;
  const latest = parseChartDate(points[points.length - 1]?.date);
  if (!latest) return points;

  const cutoff = new Date(latest);
  if (window === "1M") cutoff.setMonth(cutoff.getMonth() - 1);
  if (window === "3M") cutoff.setMonth(cutoff.getMonth() - 3);
  if (window === "1Y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  if (window === "3Y") cutoff.setFullYear(cutoff.getFullYear() - 3);
  if (window === "5Y") cutoff.setFullYear(cutoff.getFullYear() - 5);
  if (window === "10Y") cutoff.setFullYear(cutoff.getFullYear() - 10);

  const filtered = points.filter((point) => {
    const date = parseChartDate(point.date);
    return date ? date >= cutoff : false;
  });
  return filtered.length ? filtered : points.slice(-1);
}

function aggregatePerformancePoints(
  data: PerformanceResult,
  mode: "month" | "year"
) {
  const groups = new Map<string, PerfPoint>();

  for (const point of data.points) {
    const key = mode === "month" ? point.date.slice(0, 7) : point.date.slice(0, 4);
    groups.set(key, point);
  }

  const entries = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  let previousPoint: PerfPoint | null = null;

  return entries
    .map(([key, point]) => {
      const row: PerfPoint = {
        date: point.date,
        label: mode === "month" ? formatMonthAxisLabel(key) : key,
        tooltipLabel: mode === "month" ? formatMonthTooltipLabel(key) : key,
      };

      for (const series of data.series) {
        const endCumulative = numericValue(point[series.key]);
        const previousCumulative = previousPoint ? numericValue(previousPoint[series.key]) : 0;
        row[series.key] = endCumulative;
        row[series.dailyKey] =
          endCumulative == null
            ? null
            : periodReturnFromCumulative(endCumulative, previousCumulative ?? 0);
      }

      previousPoint = point;
      return row;
    })
    .filter((point) =>
      data.series.some((series) => numericValue(point[series.dailyKey]) != null)
    );
}

function numericValue(value: PerfPoint[string]): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function periodReturnFromCumulative(end: number, start: number) {
  return round2((((1 + end / 100) / (1 + start / 100)) - 1) * 100);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDayAxisLabel(date: string) {
  const parsed = parseChartDate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(parsed);
}

function formatMonthAxisLabel(period: string) {
  const parsed = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return period;
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
  }).format(parsed);
}

function formatMonthTooltipLabel(period: string) {
  const parsed = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return period;
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function formatPointLabel(date: string) {
  const parsed = parseChartDate(date);
  if (!parsed) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function getPerformanceViewDescription(
  granularity: PerformanceGranularity,
  points: PerfPoint[]
) {
  const start = points[0]?.tooltipLabel ?? points[0]?.label ?? null;
  const end = points[points.length - 1]?.tooltipLabel ?? points[points.length - 1]?.label ?? null;

  if (granularity === "1D") {
    return "Compare the latest trading session return for KSE-100 and every Portfolio.";
  }

  const unit =
    granularity === "DAY" ? "daily" : granularity === "MONTH" ? "monthly" : "yearly";
  const span = start && end ? ` Showing ${start} to ${end}.` : "";
  return `Compare ${unit} KSE-100 return with every Portfolio's ${unit} return.${span}`;
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
            <StockIdentity
              symbol={holding.symbol}
              size="xs"
              showName={false}
              subtitle={formatPKR(holding.livePrice)}
              className="min-w-0"
            />
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
