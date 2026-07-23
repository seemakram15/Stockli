"use client";

import * as React from "react";
import { CalendarClock, LineChart, TrendingUp, Wallet } from "lucide-react";
import { AllocationExplorer } from "@/components/portfolio/allocation-explorer";
import { EmptyState } from "@/components/empty-state";
import { HoldingsTable } from "@/components/holdings-table";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { ViewportLazy } from "@/components/loading/viewport-lazy";
import { LiveSummaryCards } from "@/components/live-summary-cards";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { PageHeader } from "@/components/page-header";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { PortfolioSettings } from "@/components/portfolio/portfolio-settings";
import { TransactionsPanel } from "@/components/portfolio/transactions-panel";
import { DividendsPanel } from "@/components/portfolio/dividends-panel";
import { SmartBackLink } from "@/components/smart-back-link";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketStatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/ui/accent";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { PortfolioValueChart } from "@/components/charts/portfolio-value-chart";
import { formatDate, formatNumber, formatPKR, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StockIdentity } from "@/components/stock/stock-identity";
import {
  usePersistentResource,
  type CachedRecord,
} from "@/lib/hooks/use-persistent-resource";
import {
  isPortfolioCacheFresh,
  PORTFOLIO_MUTATION_EVENT,
} from "@/lib/cache/portfolio-mutations";
import { psxLocalDateString, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { PortfolioPageData } from "@/lib/services/portfolio-page";
import type { RealizedPositionPL } from "@/lib/types";

export function CachedPortfolioDetailPage({
  id,
  userId,
  demo,
}: {
  id: string;
  userId: string;
  demo?: boolean;
  }) {
  const cacheKey = `private:portfolio:v2:${userId}:${id}`;
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const acceptPortfolioCache = React.useCallback(
    (record: CachedRecord<PortfolioPageData>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record, userId),
    [cacheClosedOnly, userId]
  );
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<PortfolioPageData>({
      cacheKey,
      url: `/api/private/portfolios/${encodeURIComponent(id)}`,
      refreshInterval: 60_000,
      pauseWhen: cacheClosedOnly,
      acceptCacheWhen: acceptPortfolioCache,
    });

  React.useEffect(() => {
    const onMutation = (event: Event) => {
      const detail = (event as CustomEvent<{ portfolioId?: string; deleted?: boolean }>).detail;
      // Skip refetch when this portfolio was just deleted — we're navigating away anyway
      if (detail?.deleted && detail.portfolioId === id) return;
      if (!detail?.portfolioId || detail.portfolioId === id) {
        void refreshNow();
      }
    };
    window.addEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
    return () => window.removeEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
  }, [id, refreshNow]);

  const currentPriceBySymbol = React.useMemo(() => {
    const holdings = data?.portfolio.holdings ?? [];
    const fallback = Object.fromEntries(
      holdings.map((holding) => [
        holding.symbol.toUpperCase(),
        Number.isFinite(holding.livePrice) ? holding.livePrice : null,
      ])
    );

    return {
      ...fallback,
      ...(data?.quoteBySymbol ?? {}),
    };
  }, [data]);

  const holdings = data?.portfolio.holdings ?? [];
  const holdingsBySymbol = Object.fromEntries(
    holdings.map((h) => [h.symbol.toUpperCase(), h.quantity])
  );
  const avgBuyPriceBySymbol = Object.fromEntries(
    holdings.map((h) => [h.symbol.toUpperCase(), h.avg_buy_price])
  );
  const taxSettings = data?.portfolio.taxSettings;
  const { liveHoldings } = useLiveHoldings(holdings);
  const liveByHoldingId = new Map(liveHoldings.map((h) => [h.id, h]));

  // The route's own <title> is static (see app/(app)/portfolios/[id]/page.tsx
  // — fetching the portfolio row there just to set a title would block the
  // page's first response byte), so set the real one here once we have it.
  const portfolioName = data?.portfolio.name;
  React.useEffect(() => {
    if (portfolioName) document.title = `${portfolioName} · Stockli`;
  }, [portfolioName]);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        {isLoading ? (
          <PageLoadingState message="Loading Portfolio..." variant="portfolio-detail" />
        ) : (
          <EmptyState
            icon={<Wallet className="size-6" />}
            title="Portfolio unavailable"
            description={
              error?.message ??
              "The saved cache is empty and fresh portfolio data could not be loaded."
            }
          />
        )}
      </div>
    );
  }

  const pf = data.portfolio;
  const { summary, transactions } = pf;

  const hasHoldings = holdings.length > 0;
  const hasHistory = transactions.length > 0;
  const lastCalendarDay = data.calendar?.days.at(-1) ?? null;

  // Portfolio value-over-time = each day's aggregated market value from the
  // P/L calendar (sum of every holding's shares × close price that day).
  // While the market's open, replace/append today's point with the live
  // total so the chart moves in real time; once closed, trust the same
  // EOD-settled data PLCalendar shows below it.
  const today = psxLocalDateString();
  const valueSeries = (data.calendar?.days ?? []).map((d) => ({
    date: d.date,
    close: d.marketValue,
  }));
  if (hasHoldings && shouldRefreshPsxData()) {
    const liveTotal = liveHoldings.reduce((sum, h) => sum + h.marketValue, 0);
    if (valueSeries.length > 0 && valueSeries[valueSeries.length - 1].date === today) {
      valueSeries[valueSeries.length - 1] = { date: today, close: liveTotal };
    } else {
      valueSeries.push({ date: today, close: liveTotal });
    }
  }
  // Freeze calendar day-P/L only after the delayed feed settlement window ends.
  const dayPLOverride =
    !shouldRefreshPsxData() && lastCalendarDay && lastCalendarDay.date === psxLocalDateString()
      ? { dayPL: lastCalendarDay.dayPL, dayPLPct: lastCalendarDay.dayPLPct }
      : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <SmartBackLink
          fallbackHref="/portfolios"
          label="Back"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        />
        <PageHeader
          icon={<Wallet />}
          accent="primary"
          title={pf.name}
          description={pf.description ?? undefined}
          actions={
            <>
              <MarketStatusBadge status={data.market.status} label={data.market.label} />
              <CacheStatusBadge
                updatedAt={data.updatedAt}
                cachedAt={cachedAt}
                isFromDeviceCache={isFromDeviceCache}
                isRefreshing={isRefreshing}
              />
              <PortfolioSettings
                id={pf.id}
                name={pf.name}
                description={pf.description}
                demo={demo}
                userId={userId}
              />
              <AddTradeDialog portfolioId={pf.id} userId={userId} holdingsBySymbol={holdingsBySymbol} avgBuyPriceBySymbol={avgBuyPriceBySymbol} taxSettings={taxSettings} />
            </>
          }
        />
      </div>

      {error && data ? (
        <p className="text-xs text-muted-foreground">
          Live refresh is unavailable right now, so the last portfolio view is still shown.
        </p>
      ) : null}

      <LiveSummaryCards
        holdings={holdings}
        liveHoldings={liveHoldings}
        realizedPL={summary.realizedPL}
        valueLabel="Value"
        dayPLOverride={dayPLOverride}
      />

      {hasHoldings && (
        <ViewportLazy minHeight={320} fallback={<DetailSectionSkeleton rows={5} />}>
          <Card>
            <CardHeader className="flex-row items-start gap-3">
              <IconChip accent="emerald"><LineChart /></IconChip>
              <div>
                <CardTitle>Portfolio value</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total market value over time, live while the market&apos;s open.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <PortfolioValueChart days={valueSeries} />
            </CardContent>
          </Card>
        </ViewportLazy>
      )}

      {!hasHoldings && !hasHistory ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No holdings in this portfolio"
          description="Record your first buy to start tracking P/L."
          action={<AddTradeDialog portfolioId={pf.id} userId={userId} holdingsBySymbol={holdingsBySymbol} avgBuyPriceBySymbol={avgBuyPriceBySymbol} taxSettings={taxSettings} />}
        />
      ) : (
        <>
          <div className={hasHoldings ? "grid gap-4 lg:grid-cols-3" : "grid gap-4"}>
            <Card className={hasHoldings ? "lg:col-span-2" : ""}>
              <CardContent className="px-0 pt-0 sm:px-2">
                <Tabs defaultValue={hasHoldings ? "holdings" : "transactions"}>
                  <div className="px-4 pt-4 sm:px-2">
                    <TabsList className="h-auto w-full flex-wrap justify-start">
                      {hasHoldings && <TabsTrigger value="holdings">Holdings</TabsTrigger>}
                      <TabsTrigger value="transactions">
                        Transactions ({transactions.length})
                      </TabsTrigger>
                      <TabsTrigger value="dividends">Dividends</TabsTrigger>
                    </TabsList>
                  </div>
                  {hasHoldings && (
                    <TabsContent value="holdings" className="mt-2">
                      <HoldingsTable holdings={holdings} rowActions={{ demo }} userId={userId} />
                    </TabsContent>
                  )}
                  <TabsContent value="transactions" className="mt-2">
                    <TransactionsPanel
                      transactions={transactions}
                      currentPriceBySymbol={currentPriceBySymbol}
                    />
                  </TabsContent>
                  <TabsContent value="dividends" className="mt-2">
                    {data?.portfolio.dividendIncome && data?.portfolio.taxSettings ? (
                      <DividendsPanel
                        dividendIncome={data.portfolio.dividendIncome}
                        taxSettings={data.portfolio.taxSettings}
                        portfolioId={pf.id}
                      />
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {hasHoldings && (
              <ViewportLazy minHeight={360} fallback={<DetailSectionSkeleton rows={6} />} className="h-full">
                <AllocationExplorer
                  holdings={holdings}
                  portfolios={[pf]}
                  defaultPortfolioId={pf.id}
                  defaultMode="holding"
                  title="Allocation"
                  description={`Explore ${pf.name}'s holdings, invested amount and live P/L.`}
                  className="h-full"
                />
              </ViewportLazy>
            )}
          </div>

          <ViewportLazy minHeight={240} fallback={<DetailSectionSkeleton rows={4} />}>
            <RealizedHistory positions={pf.realizedPositions ?? []} />
          </ViewportLazy>

          <ViewportLazy minHeight={420} fallback={<DetailSectionSkeleton rows={7} />}>
            <Card>
              <CardHeader className="flex-row items-start gap-3">
                <IconChip accent="sky"><CalendarClock /></IconChip>
                <div>
                  <CardTitle>Portfolio gain / loss calendar</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Daily PKR gain/loss across all current holdings, updated with live session prices.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <PLCalendar
                  data={data.calendar?.days ?? []}
                  hasPosition={hasHoldings}
                  livePositions={holdings.map((h) => {
                    const live = liveByHoldingId.get(h.id);
                    return {
                      symbol: h.symbol,
                      quantity: h.quantity,
                      avgBuyPrice: h.avg_buy_price,
                      initial: h.quote,
                      liveDayChange: live?.dayChange,
                      liveMarketValue: live?.marketValue,
                    };
                  })}
                />
              </CardContent>
            </Card>
          </ViewportLazy>
        </>
      )}
    </div>
  );
}

function DetailSectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

function RealizedHistory({ positions }: { positions: RealizedPositionPL[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3">
        <IconChip accent="violet"><TrendingUp /></IconChip>
        <div>
          <CardTitle>Realized gain / loss history</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Profit or loss locked in when shares are sold, calculated from the moving-average buy cost.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No realized gains or losses yet. Sold positions will appear here.
          </p>
        ) : (
          <>
            <div className="space-y-3 sm:hidden">
              {positions.map((row) => (
                <article key={row.symbol} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <StockIdentity
                      href={`/stock/${row.symbol}`}
                      symbol={row.symbol}
                      size="sm"
                      showName={false}
                      subtitle={`${row.tradesCount} sale${row.tradesCount === 1 ? "" : "s"} · ${
                        row.lastSoldAt ? formatDate(row.lastSoldAt) : "—"
                      }`}
                    />
                    <div className={cn("text-right font-medium tabular-nums", plColorClass(row.realizedPL))}>
                      <p>{formatPKR(row.realizedPL, { sign: true })}</p>
                      <p className="text-xs">{formatPercent(row.realizedPLPct)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <RealizedMetric label="Sold qty" value={formatNumber(row.quantitySold, 0)} />
                    <RealizedMetric label="Proceeds" value={formatPKR(row.proceeds)} align="right" />
                    <RealizedMetric label="Cost basis" value={formatPKR(row.costBasis)} />
                    <RealizedMetric label="Fees" value={formatPKR(row.fees)} align="right" />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto scrollbar-thin sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Symbol</th>
                    <th className="py-2 text-right font-medium">Sold qty</th>
                    <th className="py-2 text-right font-medium">Cost basis</th>
                    <th className="py-2 text-right font-medium">Proceeds</th>
                    <th className="py-2 text-right font-medium">Realized P/L</th>
                    <th className="py-2 text-right font-medium">Last sale</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((row) => (
                    <tr key={row.symbol} className="border-b last:border-0">
                      <td className="py-3">
                        <StockIdentity
                          href={`/stock/${row.symbol}`}
                          symbol={row.symbol}
                          size="xs"
                          showName={false}
                        />
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {formatNumber(row.quantitySold, 0)}
                      </td>
                      <td className="py-3 text-right tabular-nums">{formatPKR(row.costBasis)}</td>
                      <td className="py-3 text-right tabular-nums">{formatPKR(row.proceeds)}</td>
                      <td className={cn("py-3 text-right tabular-nums", plColorClass(row.realizedPL))}>
                        <p className="font-medium">{formatPKR(row.realizedPL, { sign: true })}</p>
                        <p className="text-xs">{formatPercent(row.realizedPLPct)}</p>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {row.lastSoldAt ? formatDate(row.lastSoldAt) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RealizedMetric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
