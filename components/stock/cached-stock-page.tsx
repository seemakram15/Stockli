"use client";

import * as React from "react";
import { CalendarRange, TrendingUp } from "lucide-react";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { Badge } from "@/components/ui/badge";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { DataDelayBadge, MarketStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { LiveQuote } from "@/components/live-quote";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { PriceChart } from "@/components/charts/price-chart";
import { SmartBackLink } from "@/components/smart-back-link";
import { StockFinancialsPanel } from "@/components/stock/stock-financials-panel";
import { WatchButton } from "@/components/watch-button";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { formatCompact, formatDate, formatPercent, formatPKR, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockPageData, StockPositionSummary } from "@/lib/services/stock-page";
import type { HoldingWithMetrics } from "@/lib/types";

export function CachedStockPage({ symbol, userId }: { symbol: string; userId: string }) {
  const normalizedSymbol = symbol.toUpperCase();
  const cacheKey = `private:stock:${userId}:${normalizedSymbol}`;
  const legacyCacheKeys = React.useMemo(() => [`private:stock:${normalizedSymbol}`], [normalizedSymbol]);
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<StockPageData>({
      cacheKey,
      url: `/api/private/stocks/${encodeURIComponent(symbol)}`,
      refreshInterval: 60_000,
      pauseWhen: cacheClosedOnly,
      acceptCacheWhen: cacheClosedOnly,
      legacyCacheKeys,
    });

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        {isLoading ? (
          <PageLoadingState message="Loading Stock..." variant="stock" />
        ) : (
          <EmptyState
            icon={<TrendingUp className="size-6" />}
            title="Stock unavailable"
            description={
              error?.message ??
              "The saved cache is empty and fresh stock data could not be loaded."
            }
          />
        )}
      </div>
    );
  }

  return <StockPageView data={data} error={error} isRefreshing={isRefreshing} isFromDeviceCache={isFromDeviceCache} cachedAt={cachedAt} />;
}

function StockPageView({
  data,
  error,
  isRefreshing,
  isFromDeviceCache,
  cachedAt,
}: {
  data: StockPageData;
  error?: Error;
  isRefreshing: boolean;
  isFromDeviceCache: boolean;
  cachedAt: string | null;
}) {
  const { detail, portfolios, watchedSymbols, symbol } = data;
  const { ticker, quote, candles, intraday } = detail;
  const { liveHoldings: positionRows } = useLiveHoldings(data.positionRows);
  const summary = React.useMemo(() => summarizePositionRows(positionRows), [positionRows]);
  const hasPosition = summary.totalQty > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref="/market" label="Back" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{symbol}</h1>
            {ticker?.sector && <Badge variant="secondary">{ticker.sector}</Badge>}
          </div>
          <p className="mt-1 text-muted-foreground">{ticker?.company_name ?? symbol}</p>
          <div className="mt-3">
            <LiveQuote symbol={symbol} initial={quote} />
          </div>
          {error ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Live refresh is unavailable right now, so the last stock view is still shown.
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <MarketStatusBadge
            status={data.market.status}
            label={data.market.label}
            className="w-full justify-center sm:w-auto sm:justify-start"
          />
          <CacheStatusBadge
            updatedAt={data.updatedAt}
            cachedAt={cachedAt}
            isFromDeviceCache={isFromDeviceCache}
            isRefreshing={isRefreshing}
            className="hidden sm:inline-flex"
          />
          <div
            className={cn(
              "grid gap-2 sm:contents [&_button]:min-w-0 [&_button]:w-full [&_form]:min-w-0 sm:[&_button]:w-auto",
              portfolios.length > 0 ? "grid-cols-3" : "grid-cols-2"
            )}
          >
            <WatchButton symbol={symbol} initialWatching={watchedSymbols.includes(symbol)} />
            <CreateAlertDialog defaultSymbol={symbol} />
            {portfolios.length > 0 && (
              <AddTradeDialog portfolioId={portfolios[0].id} defaultSymbol={symbol} />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Price</CardTitle>
            <DataDelayBadge />
          </CardHeader>
          <CardContent>
            <PriceChart candles={candles} intraday={intraday} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Today</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Stat label="Open" value={formatPKR(quote?.open ?? null)} />
              <Stat label="Prev close" value={formatPKR(quote?.ldcp ?? null)} />
              <Stat label="High" value={formatPKR(quote?.high ?? null)} />
              <Stat label="Low" value={formatPKR(quote?.low ?? null)} />
              <Stat label="Volume" value={formatCompact(quote?.volume ?? null)} />
              <Stat
                label="Change"
                value={
                  <span className="inline-flex flex-wrap justify-end gap-x-1">
                    <span>{formatPKR(quote?.change ?? null, { sign: true })}</span>
                    <span className="text-muted-foreground">
                      ({formatPercent(quote?.changePct)})
                    </span>
                  </span>
                }
                className={plColorClass(quote?.change)}
              />
            </CardContent>
          </Card>

          {hasPosition && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your position</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Stat label="Quantity" value={formatCompact(summary.totalQty)} />
                <Stat label="Avg cost" value={formatPKR(summary.avgCost)} />
                <Stat label="Market value" value={formatPKR(summary.marketValue)} />
                <Stat label="Cost basis" value={formatPKR(summary.costBasis)} />
                <Stat
                  label="Day unrealized P/L"
                  value={
                    <>
                      {formatPKR(summary.dayUnrealizedPL, { sign: true })}
                      <span className="ml-1 text-muted-foreground">
                        ({formatPercent(summary.dayUnrealizedPLPct)})
                      </span>
                    </>
                  }
                  className={plColorClass(summary.dayUnrealizedPL)}
                />
                <Stat
                  label="Total unrealized P/L"
                  value={formatPKR(summary.unrealizedPL, { sign: true })}
                  className={plColorClass(summary.unrealizedPL)}
                />
                <Stat
                  label="Total return"
                  value={formatPercent(summary.unrealizedPLPct)}
                  className={plColorClass(summary.unrealizedPLPct)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <StockFinancialsPanel symbol={symbol} companyName={ticker?.company_name} />

      <Card>
        <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:justify-between">
          <div className="flex items-start gap-2">
            <CalendarRange className="mt-0.5 size-5 text-primary" />
            <div>
              <CardTitle>Daily gain / loss calendar</CardTitle>
              <CardDescription>
                {data.calendar.hasPosition
                  ? `Coloured by your position's daily P/L — green for gains, red for losses${data.calendar.firstDate ? `, from your first buy on ${formatDate(data.calendar.firstDate)}` : ""}.`
                  : "Coloured by the stock's daily move. Add a position to track your P/L per day."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PLCalendar
            data={data.calendar.days}
            hasPosition={data.calendar.hasPosition}
            livePositions={
              hasPosition
                ? [{ symbol, quantity: summary.totalQty, initial: quote }]
                : []
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function summarizePositionRows(rows: HoldingWithMetrics[]): StockPositionSummary {
  const totalQty = rows.reduce((sum, holding) => sum + holding.quantity, 0);
  const costBasis = rows.reduce((sum, holding) => sum + holding.costBasis, 0);
  const marketValue = rows.reduce((sum, holding) => sum + holding.marketValue, 0);
  const dayUnrealizedPL = rows.reduce((sum, holding) => sum + holding.dayChange, 0);
  const prevValue = marketValue - dayUnrealizedPL;
  const unrealizedPL = rows.reduce((sum, holding) => sum + holding.unrealizedPL, 0);

  return {
    totalQty,
    costBasis,
    avgCost: totalQty ? costBasis / totalQty : 0,
    marketValue,
    dayUnrealizedPL,
    dayUnrealizedPLPct: prevValue ? (dayUnrealizedPL / prevValue) * 100 : 0,
    unrealizedPL,
    unrealizedPLPct: costBasis ? (unrealizedPL / costBasis) * 100 : 0,
  };
}

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums [overflow-wrap:anywhere] ${className ?? ""}`}>
        {value}
      </p>
    </div>
  );
}
