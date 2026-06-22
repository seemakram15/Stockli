import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Shield, Wallet, TrendingUp, Coins, Bell, Star, Eye } from "lucide-react";
import { getUserOverview } from "@/lib/services/admin";
import { isDemoMode } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChangeBadge } from "@/components/change-badge";
import { HoldingsTable } from "@/components/holdings-table";
import { TransactionsTable } from "@/components/transactions-table";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { EmptyState } from "@/components/empty-state";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = { title: "User account" };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Reject malformed ids early (avoids invalid-uuid query errors / probing).
  if (!isDemoMode && !UUID_RE.test(id)) notFound();

  const overview = await getUserOverview(id);
  if (!overview) notFound();

  const { profile, email, portfolios, holdings, summary, sectorAllocation, transactions, watchlistSymbols, alerts } =
    overview;
  const portfolioNames = Object.fromEntries(portfolios.map((p) => [p.id, p.name]));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Admin
      </Link>

      {/* Impersonation/view notice */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm">
        <Eye className="size-4 text-primary" />
        <span className="text-muted-foreground">
          Viewing another user&apos;s account as superadmin (read-only).
        </span>
      </div>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {profile.displayName ?? email ?? "User"}
            {profile.role === "superadmin" && (
              <Badge className="gap-1">
                <Shield className="size-3" /> Superadmin
              </Badge>
            )}
          </span>
        }
        description={email ?? profile.id}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Value" value={formatPKR(summary.totalValue)} icon={<Wallet className="size-4" />} />
        <StatCard
          label="Total P/L"
          value={formatPKR(summary.totalPL, { sign: true })}
          tone={summary.totalPL > 0 ? "gain" : summary.totalPL < 0 ? "loss" : "default"}
          icon={<TrendingUp className="size-4" />}
          sub={<ChangeBadge pct={summary.totalPLPct} variant="pill" />}
        />
        <StatCard label="Invested" value={formatPKR(summary.totalInvested)} icon={<Coins className="size-4" />} />
        <StatCard
          label="Portfolios"
          value={portfolios.length}
          icon={<Wallet className="size-4" />}
          sub={<span className="text-muted-foreground">{summary.holdingsCount} holdings</span>}
        />
      </div>

      {holdings.length === 0 ? (
        <EmptyState icon={<Wallet className="size-6" />} title="This user has no holdings yet" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-2">
              <HoldingsTable holdings={holdings} showPortfolio portfolioNames={portfolioNames} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart data={sectorAllocation} />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transactions ({transactions.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-2">
            <TransactionsTable transactions={transactions} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Star className="size-4 text-chart-3" />
              <CardTitle className="text-base">Watchlist ({watchlistSymbols.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {watchlistSymbols.length === 0 ? (
                <p className="text-sm text-muted-foreground">No watched symbols.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {watchlistSymbols.map((s) => (
                    <Link key={s} href={`/stock/${s}`}>
                      <Badge variant="secondary">{s}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Alerts ({alerts.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alerts.</p>
              ) : (
                alerts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <Link href={`/stock/${a.symbol}`} className="font-medium hover:text-primary">
                      {a.symbol}
                    </Link>
                    <span className="text-muted-foreground">
                      {a.condition === "ABOVE" ? "≥" : "≤"} {formatPKR(a.target_price)}{" "}
                      <span className={a.is_active ? "text-gain" : "text-muted-foreground"}>
                        ({a.is_active ? "active" : "off"})
                      </span>
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
