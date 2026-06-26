"use client";

import * as React from "react";
import { CalendarClock, TrendingUp, Wallet } from "lucide-react";
import { AllocationExplorer } from "@/components/portfolio/allocation-explorer";
import { EmptyState } from "@/components/empty-state";
import { HoldingsTable } from "@/components/holdings-table";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { LiveSummaryCards } from "@/components/live-summary-cards";
import { PageHeader } from "@/components/page-header";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { PortfolioSettings } from "@/components/portfolio/portfolio-settings";
import { TransactionsPanel } from "@/components/portfolio/transactions-panel";
import { SmartBackLink } from "@/components/smart-back-link";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketStatusBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { formatDate, formatNumber, formatPKR, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  usePersistentResource,
  type CachedRecord,
} from "@/lib/hooks/use-persistent-resource";
import {
  isPortfolioCacheFresh,
  PORTFOLIO_MUTATION_EVENT,
} from "@/lib/cache/portfolio-mutations";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
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
  const cacheKey = `private:portfolio:${userId}:${id}`;
  const legacyCacheKeys = React.useMemo(() => [`private:portfolio:${id}`], [id]);
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const acceptPortfolioCache = React.useCallback(
    (record: CachedRecord<PortfolioPageData>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record),
    [cacheClosedOnly]
  );
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<PortfolioPageData>({
      cacheKey,
      url: `/api/private/portfolios/${encodeURIComponent(id)}`,
      refreshInterval: 60_000,
      pauseWhen: cacheClosedOnly,
      acceptCacheWhen: acceptPortfolioCache,
      legacyCacheKeys,
    });

  React.useEffect(() => {
    const onMutation = (event: Event) => {
      const detail = (event as CustomEvent<{ portfolioId?: string }>).detail;
      if (!detail?.portfolioId || detail.portfolioId === id) {
        void refreshNow();
      }
    };
    window.addEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
    return () => window.removeEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
  }, [id, refreshNow]);

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl">
        {isLoading ? (
          <PageLoadingState message="Loading portfolio..." />
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
  const { summary, holdings, transactions } = pf;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <SmartBackLink
          fallbackHref="/portfolios"
          label="Back"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        />
        <PageHeader
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
              />
              <AddTradeDialog portfolioId={pf.id} />
            </>
          }
        />
      </div>

      {error && data ? (
        <p className="text-xs text-muted-foreground">
          Live refresh is unavailable right now, so the last portfolio view is still shown.
        </p>
      ) : null}

      <LiveSummaryCards holdings={holdings} realizedPL={summary.realizedPL} valueLabel="Value" />

      {holdings.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No holdings in this portfolio"
          description="Record your first buy to start tracking P/L."
          action={<AddTradeDialog portfolioId={pf.id} />}
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="px-0 pt-0 sm:px-2">
                <Tabs defaultValue="holdings">
                  <div className="px-4 pt-4 sm:px-2">
                    <TabsList className="h-auto w-full flex-wrap justify-start">
                      <TabsTrigger value="holdings">Holdings</TabsTrigger>
                      <TabsTrigger value="transactions">
                        Transactions ({transactions.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="holdings" className="mt-2">
                    <HoldingsTable holdings={holdings} rowActions={{ demo }} />
                  </TabsContent>
                  <TabsContent value="transactions" className="mt-2">
                    <TransactionsPanel transactions={transactions} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <AllocationExplorer
              holdings={holdings}
              portfolios={[pf]}
              defaultPortfolioId={pf.id}
              defaultMode="holding"
              title="Allocation"
              description={`Explore ${pf.name}'s holdings, invested amount and live P/L.`}
              className="h-full"
            />
          </div>

          <RealizedHistory positions={pf.realizedPositions ?? []} />

          <Card>
            <CardHeader className="flex-col items-start gap-2 sm:flex-row">
              <CalendarClock className="mt-0.5 size-5 text-primary" />
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
                hasPosition
                livePositions={holdings.map((h) => ({
                  symbol: h.symbol,
                  quantity: h.quantity,
                  initial: h.quote,
                }))}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function RealizedHistory({ positions }: { positions: RealizedPositionPL[] }) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-2 sm:flex-row">
        <TrendingUp className="mt-0.5 size-5 text-primary" />
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
                    <div>
                      <p className="font-semibold">{row.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.tradesCount} sale{row.tradesCount === 1 ? "" : "s"} ·{" "}
                        {row.lastSoldAt ? formatDate(row.lastSoldAt) : "—"}
                      </p>
                    </div>
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
                      <td className="py-3 font-medium">{row.symbol}</td>
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
