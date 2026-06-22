import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, Wallet } from "lucide-react";
import { getPortfolio, getPortfolioView } from "@/lib/services/portfolio";
import { getPortfolioCalendar } from "@/lib/services/daily-pl";
import { isDemoMode } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { LiveSummaryCards } from "@/components/live-summary-cards";
import { HoldingsTable } from "@/components/holdings-table";
import { TransactionsPanel } from "@/components/portfolio/transactions-panel";
import { AllocationExplorer } from "@/components/dashboard/allocation-explorer";
import { PLCalendar } from "@/components/charts/pl-calendar";
import { EmptyState } from "@/components/empty-state";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { PortfolioSettings } from "@/components/portfolio/portfolio-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pf = await getPortfolio(id);
  return { title: pf?.name ?? "Portfolio" };
}

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pf = await getPortfolioView(id);
  if (!pf) notFound();

  const { summary, holdings, transactions } = pf;
  const calendar = holdings.length ? await getPortfolioCalendar(holdings, transactions) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <SmartBackLink fallbackHref="/portfolios" label="Back" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" />
        <PageHeader
          title={pf.name}
          description={pf.description ?? undefined}
          actions={
            <>
              <PortfolioSettings
                id={pf.id}
                name={pf.name}
                description={pf.description}
                demo={isDemoMode}
              />
              <AddTradeDialog portfolioId={pf.id} />
            </>
          }
        />
      </div>

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
                  <div className="overflow-x-auto px-4 pt-4 scrollbar-thin sm:px-2">
                    <TabsList className="min-w-max">
                      <TabsTrigger value="holdings">Holdings</TabsTrigger>
                      <TabsTrigger value="transactions">
                        Transactions ({transactions.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="holdings" className="mt-2">
                    <HoldingsTable holdings={holdings} rowActions={{ demo: isDemoMode }} />
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
                data={calendar?.days ?? []}
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
