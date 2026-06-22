import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Coins, TrendingUp, CalendarClock, Wallet } from "lucide-react";
import { getPortfolioView, getTransactions } from "@/lib/services/portfolio";
import { allocationByHolding } from "@/lib/services/metrics";
import { isDemoMode } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChangeBadge } from "@/components/change-badge";
import { HoldingsTable } from "@/components/holdings-table";
import { TransactionsTable } from "@/components/transactions-table";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { EmptyState } from "@/components/empty-state";
import { AddTradeDialog } from "@/components/portfolio/add-trade-dialog";
import { PortfolioSettings } from "@/components/portfolio/portfolio-settings";
import { formatPKR } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pf = await getPortfolioView(id);
  return { title: pf?.name ?? "Portfolio" };
}

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [pf, transactions] = await Promise.all([
    getPortfolioView(id),
    getTransactions(id),
  ]);
  if (!pf) notFound();

  const { summary, holdings } = pf;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Link
          href="/portfolios"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Portfolios
        </Link>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Value" value={formatPKR(summary.totalValue)} icon={<Wallet className="size-4" />} />
        <StatCard
          label="Total P/L"
          value={formatPKR(summary.totalPL, { sign: true })}
          tone={summary.totalPL > 0 ? "gain" : summary.totalPL < 0 ? "loss" : "default"}
          icon={<TrendingUp className="size-4" />}
          sub={<ChangeBadge pct={summary.totalPLPct} variant="pill" />}
        />
        <StatCard
          label="Day's P/L"
          value={formatPKR(summary.dayPL, { sign: true })}
          tone={summary.dayPL > 0 ? "gain" : summary.dayPL < 0 ? "loss" : "default"}
          icon={<CalendarClock className="size-4" />}
          sub={<ChangeBadge pct={summary.dayPLPct} variant="pill" />}
        />
        <StatCard
          label="Invested"
          value={formatPKR(summary.totalInvested)}
          icon={<Coins className="size-4" />}
          sub={
            <span className="text-muted-foreground">
              Realized {formatPKR(summary.realizedPL, { sign: true })}
            </span>
          }
        />
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No holdings in this portfolio"
          description="Record your first buy to start tracking P/L."
          action={<AddTradeDialog portfolioId={pf.id} />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="px-0 pt-0 sm:px-2">
              <Tabs defaultValue="holdings">
                <div className="px-4 pt-4 sm:px-2">
                  <TabsList>
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
                  <TransactionsTable transactions={transactions} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart data={allocationByHolding(holdings)} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
