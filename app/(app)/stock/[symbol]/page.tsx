import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarRange } from "lucide-react";
import { getStockDetail } from "@/lib/services/stock";
import { getDailyPL } from "@/lib/services/daily-pl";
import { getPortfolios, getWatchlistSymbols } from "@/lib/services/portfolio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "@/components/charts/price-chart";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { LiveQuote } from "@/components/live-quote";
import { WatchButton } from "@/components/watch-button";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { DataDelayBadge } from "@/components/status-badges";
import { formatPKR, formatCompact, formatPercent, plColorClass } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  return { title: symbol.toUpperCase() };
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: symbolRaw } = await params;
  const symbol = symbolRaw.toUpperCase();

  const [detail, portfolios, watched] = await Promise.all([
    getStockDetail(symbol),
    getPortfolios(),
    getWatchlistSymbols(),
  ]);
  const { ticker, quote, candles, intraday, holdings } = detail;

  const totalQty = holdings.reduce((a, h) => a + h.quantity, 0);
  const hasPosition = totalQty > 0;
  const costBasis = holdings.reduce((a, h) => a + h.quantity * h.avg_buy_price, 0);
  const avgCost = hasPosition ? costBasis / totalQty : 0;
  const price = quote?.price ?? avgCost;
  const marketValue = price * totalQty;
  const unrealizedPL = marketValue - costBasis;
  const unrealizedPLPct = costBasis ? (unrealizedPL / costBasis) * 100 : 0;

  const dailyPL = await getDailyPL(symbol, hasPosition ? totalQty : 1);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href="/market"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Market
      </Link>

      {/* Header */}
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WatchButton symbol={symbol} initialWatching={watched.includes(symbol)} />
          <CreateAlertDialog defaultSymbol={symbol} />
          {portfolios.length > 0 && (
            <AddTradeDialog portfolioId={portfolios[0].id} defaultSymbol={symbol} />
          )}
        </div>
      </div>

      {/* Chart + stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
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
                value={formatPercent(quote?.changePct)}
                className={plColorClass(quote?.changePct)}
              />
            </CardContent>
          </Card>

          {hasPosition && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your position</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Stat label="Quantity" value={formatCompact(totalQty)} />
                <Stat label="Avg cost" value={formatPKR(avgCost)} />
                <Stat label="Market value" value={formatPKR(marketValue)} />
                <Stat label="Cost basis" value={formatPKR(costBasis)} />
                <Stat
                  label="Unrealized P/L"
                  value={formatPKR(unrealizedPL, { sign: true })}
                  className={plColorClass(unrealizedPL)}
                />
                <Stat
                  label="Return"
                  value={formatPercent(unrealizedPLPct)}
                  className={plColorClass(unrealizedPLPct)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Large daily P/L calendar */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <CalendarRange className="mt-0.5 size-5 text-primary" />
            <div>
              <CardTitle>Daily gain / loss calendar</CardTitle>
              <CardDescription>
                {hasPosition
                  ? "Each day is coloured by your position's P/L — green for gains, red for losses."
                  : "Each day is coloured by the stock's daily move. Add a position to see your P/L per day."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PLCalendar data={dailyPL} hasPosition={hasPosition} />
        </CardContent>
      </Card>
    </div>
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
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums ${className ?? ""}`}>{value}</p>
    </div>
  );
}
