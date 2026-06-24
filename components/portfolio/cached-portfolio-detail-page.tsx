"use client";

import * as React from "react";
import { CalendarClock, Wallet } from "lucide-react";
import { AllocationExplorer } from "@/components/dashboard/allocation-explorer";
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
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { PortfolioPageData } from "@/lib/services/portfolio-page";

export function CachedPortfolioDetailPage({
  id,
  demo,
}: {
  id: string;
  demo?: boolean;
}) {
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<PortfolioPageData>({
      cacheKey: `private:portfolio:${id}`,
      url: `/api/private/portfolios/${encodeURIComponent(id)}`,
      refreshInterval: 60_000,
      pauseWhen: cacheClosedOnly,
      acceptCacheWhen: cacheClosedOnly,
    });

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
