import type { Metadata } from "next";
import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  Coins,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
} from "lucide-react";
import { getDashboard } from "@/lib/services/portfolio";
import { getPortfolioPerformance } from "@/lib/services/performance";
import { marketStatus } from "@/lib/psx/market-hours";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChangeBadge } from "@/components/change-badge";
import { HoldingsTable } from "@/components/holdings-table";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { EmptyState } from "@/components/empty-state";
import { MarketStatusBadge } from "@/components/status-badges";
import { formatPKR, formatPercent, plColorClass } from "@/lib/format";
import type { HoldingWithMetrics } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboard();
  const { summary, holdings, portfolios } = data;
  const performance = await getPortfolioPerformance(
    holdings.map((h) => ({ symbol: h.symbol, quantity: h.quantity })),
    120
  );
  const market = marketStatus();
  const portfolioNames = Object.fromEntries(portfolios.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your positions across all portfolios, at a glance."
        actions={
          <>
            <MarketStatusBadge status={market.status} label={market.label} />
            <Button asChild size="sm">
              <Link href="/portfolios">
                <Plus className="size-4" /> Manage
              </Link>
            </Button>
          </>
        }
      />

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
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Value"
              value={formatPKR(summary.totalValue)}
              icon={<Wallet className="size-4" />}
              sub={
                <span className="text-muted-foreground">
                  {summary.holdingsCount} positions
                </span>
              }
            />
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

          {/* Performance + Allocation */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Performance vs KSE-100</CardTitle>
                <span className="text-xs text-muted-foreground">Last 120 trading days</span>
              </CardHeader>
              <CardContent>
                <PerformanceChart data={performance} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Sector allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <AllocationChart data={data.sectorAllocation} />
              </CardContent>
            </Card>
          </div>

          {/* Movers */}
          <div className="grid gap-4 md:grid-cols-2">
            <MoversCard title="Top performers" icon="up" items={data.topGainers} />
            <MoversCard title="Lagging positions" icon="down" items={data.topLosers} />
          </div>

          {/* Holdings */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>All holdings</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portfolios">View portfolios</Link>
              </Button>
            </CardHeader>
            <CardContent className="px-0 sm:px-2">
              <HoldingsTable holdings={holdings} showPortfolio portfolioNames={portfolioNames} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
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
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        {icon === "up" ? (
          <ArrowUpRight className="size-4 text-gain" />
        ) : (
          <ArrowDownRight className="size-4 text-loss" />
        )}
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No data.</p>
        )}
        {items.map((h) => (
          <Link
            key={h.id}
            href={`/stock/${h.symbol}`}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-accent/50"
          >
            <div>
              <p className="font-medium">{h.symbol}</p>
              <p className="text-xs text-muted-foreground">
                {formatPKR(h.quote?.price ?? h.avg_buy_price)}
              </p>
            </div>
            <div className="text-right">
              <p className={`font-medium tabular-nums ${plColorClass(h.unrealizedPL)}`}>
                {formatPKR(h.unrealizedPL, { sign: true })}
              </p>
              <p className={`text-xs tabular-nums ${plColorClass(h.unrealizedPLPct)}`}>
                {formatPercent(h.unrealizedPLPct)}
              </p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
