"use client";

import * as React from "react";
import { Banknote, CalendarRange, LineChart, TrendingUp, Wallet } from "lucide-react";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { Badge } from "@/components/ui/badge";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/ui/accent";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { DataDelayBadge, MarketStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { LiveQuote } from "@/components/live-quote";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { PriceChart } from "@/components/charts/price-chart";
import { SmartBackLink } from "@/components/smart-back-link";
import { StockFinancialsPanel } from "@/components/stock/stock-financials-panel";
import { StockFundHolders } from "@/components/stock/stock-fund-holders";
import { StockLogo } from "@/components/stock/stock-logo";
import { WatchButton } from "@/components/watch-button";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { formatCompact, formatDate, formatNumber, formatPercent, formatPKR, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StockPageData, StockPositionSummary } from "@/lib/services/stock-page";
import type { CdcDividend, HoldingWithMetrics } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CachedStockPage({ symbol, userId }: { symbol: string; userId: string }) {
  const normalizedSymbol = symbol.toUpperCase();
  const cacheKey = `private:stock:${userId}:${normalizedSymbol}`;
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<StockPageData>({
      cacheKey,
      url: `/api/private/stocks/${encodeURIComponent(symbol)}`,
      refreshInterval: 60_000,
      pauseWhen: cacheClosedOnly,
      acceptCacheWhen: cacheClosedOnly,
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

  return (
    <StockPageView
      data={data}
      error={error}
      isRefreshing={isRefreshing}
      isFromDeviceCache={isFromDeviceCache}
      cachedAt={cachedAt}
      userId={userId}
    />
  );
}

function StockPageView({
  data,
  error,
  isRefreshing,
  isFromDeviceCache,
  cachedAt,
  userId,
}: {
  data: StockPageData;
  error?: Error;
  isRefreshing: boolean;
  isFromDeviceCache: boolean;
  cachedAt: string | null;
  userId: string;
}) {
  const { detail, portfolios, watchedSymbols, symbol, cdcDividends } = data;
  const { ticker, quote, candles, intraday } = detail;
  const { liveHoldings: positionRows } = useLiveHoldings(data.positionRows);
  const summary = React.useMemo(() => summarizePositionRows(positionRows), [positionRows]);
  const hasPosition = summary.totalQty > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref="/market" label="Back" />

      <div className="relative flex flex-col gap-4 overflow-hidden rounded-3xl bg-card p-4 shadow-soft ring-1 ring-foreground/10 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-brand-mesh-faint" aria-hidden />
        <div className="relative">
          <div className="flex items-start gap-3 sm:gap-4">
            <StockLogo symbol={symbol} name={ticker?.company_name} size="lg" className="mt-0.5" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{symbol}</h1>
                {ticker?.sector && <Badge variant="info">{ticker.sector}</Badge>}
              </div>
              <p className="mt-1 text-muted-foreground">{ticker?.company_name ?? symbol}</p>
            </div>
          </div>
          <div className="mt-3">
            <LiveQuote symbol={symbol} initial={quote} />
          </div>
          {error ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Live refresh is unavailable right now, so the last stock view is still shown.
            </p>
          ) : null}
        </div>
        <div className="relative grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
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
              <AddTradeDialog portfolioId={portfolios[0].id} defaultSymbol={symbol} userId={userId} />
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <IconChip accent="emerald"><LineChart /></IconChip>
              <CardTitle>Price</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <PriceChart candles={candles} intraday={intraday} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-3">
              <IconChip accent="sky"><CalendarRange /></IconChip>
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
              <CardHeader className="flex-row items-center gap-3">
                <IconChip accent="violet"><Wallet /></IconChip>
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

      {cdcDividends.length > 0 && <StockDividendHistory dividends={cdcDividends} />}

      <StockFinancialsPanel symbol={symbol} companyName={ticker?.company_name} />

      <StockFundHolders symbol={symbol} />

      <Card>
        <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:justify-between">
          <div className="flex items-start gap-3">
            <IconChip accent="emerald"><CalendarRange /></IconChip>
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
                ? [{ symbol, quantity: summary.totalQty, avgBuyPrice: summary.avgCost, initial: quote }]
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

function StockDividendHistory({ dividends }: { dividends: CdcDividend[] }) {
  const totalNet = dividends.reduce((s, d) => s + Number(d.net_amount), 0);
  const totalGross = dividends.reduce((s, d) => s + Number(d.gross_amount), 0);

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <IconChip accent="amber"><Banknote /></IconChip>
          <div>
            <CardTitle>Dividend history</CardTitle>
            <CardDescription>
              Official CDC records · {dividends.length} payment{dividends.length !== 1 ? "s" : ""} · Total net {formatPKR(totalNet)}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Gross received</p>
            <p className="font-semibold tabular-nums">{formatPKR(totalGross)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Net received</p>
            <p className="font-semibold tabular-nums text-gain">{formatPKR(totalNet)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 sm:px-2">
        <div className="space-y-3 px-4 sm:hidden">
          {dividends.map((d) => (
            <div key={d.id} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{formatDate(d.payment_date)}</span>
                {d.financial_year && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    FY{d.financial_year}
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">Rate / share</p>
                  <p className="tabular-nums font-medium">{formatPKR(Number(d.rate_per_security))}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Securities</p>
                  <p className="tabular-nums font-medium">{formatNumber(Number(d.no_of_securities), 0)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Gross</p>
                  <p className="tabular-nums">{formatPKR(Number(d.gross_amount))}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">WHT</p>
                  <p className="tabular-nums text-loss">{formatPKR(Number(d.tax_deducted))}</p>
                </div>
                {Number(d.zakat_deducted) > 0 && (
                  <div>
                    <p className="text-[11px] text-muted-foreground">Zakat</p>
                    <p className="tabular-nums text-muted-foreground">{formatPKR(Number(d.zakat_deducted))}</p>
                  </div>
                )}
                <div className={Number(d.zakat_deducted) > 0 ? "text-right" : "col-span-2 text-right"}>
                  <p className="text-[11px] text-muted-foreground">Amount paid</p>
                  <p className="tabular-nums font-semibold text-gain">{formatPKR(Number(d.net_amount))}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto scrollbar-thin sm:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Payment date</TableHead>
                <TableHead>FY</TableHead>
                <TableHead>Warrant #</TableHead>
                <TableHead className="text-right">Rate / Share</TableHead>
                <TableHead className="text-right">Securities</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">WHT</TableHead>
                <TableHead className="text-right">Zakat</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dividends.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{formatDate(d.payment_date)}</TableCell>
                  <TableCell className="text-muted-foreground">{d.financial_year ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{d.warrant_no ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPKR(Number(d.rate_per_security))}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Number(d.no_of_securities), 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPKR(Number(d.gross_amount))}</TableCell>
                  <TableCell className="text-right tabular-nums text-loss">{formatPKR(Number(d.tax_deducted))}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Number(d.zakat_deducted) > 0 ? formatPKR(Number(d.zakat_deducted)) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-gain">
                    {formatPKR(Number(d.net_amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
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
