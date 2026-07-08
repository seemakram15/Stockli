import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shield, Wallet, Bell, Star, Eye } from "lucide-react";
import { getUserOverview } from "@/lib/services/admin";
import { isDemoMode } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { IconChip } from "@/components/ui/accent";
import { SmartBackLink } from "@/components/smart-back-link";
import { LiveSummaryCards } from "@/components/live-summary-cards";
import { HoldingsTable } from "@/components/holdings-table";
import { TransactionsTable } from "@/components/transactions-table";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { EmptyState } from "@/components/empty-state";
import { AdminDeleteUserButton } from "@/components/admin/admin-delete-user-button";
import { getSessionContext } from "@/lib/auth/roles";
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

  const [{ user: viewer }, overview] = await Promise.all([getSessionContext(), getUserOverview(id)]);
  if (!overview) notFound();

  const { profile, email, portfolios, holdings, summary, sectorAllocation, transactions, watchlistSymbols, alerts } =
    overview;
  const portfolioNames = Object.fromEntries(portfolios.map((p) => [p.id, p.name]));
  const isOwnAccount = viewer?.id === profile.id;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref="/admin" label="Back" />

      {/* Impersonation/view notice */}
      <div className="flex items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm">
        <Eye className="size-4 text-sky-600 dark:text-sky-400" />
        <span className="text-muted-foreground">
          {isOwnAccount
            ? "Viewing your own account inside the admin area."
            : "Viewing another user's account as superadmin (read-only)."}
        </span>
      </div>

      <PageHeader
        icon={<Shield />}
        accent="primary"
        eyebrow="User account"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {profile.displayName ?? email ?? "User"}
            {profile.role === "superadmin" && (
              <Badge variant="violet">
                <Shield className="size-3" /> Superadmin
              </Badge>
            )}
          </span>
        }
        description={email ?? profile.id}
      />

      {!isOwnAccount ? (
        <div className="flex justify-end">
          <AdminDeleteUserButton
            userId={profile.id}
            email={email}
            displayName={profile.displayName}
            role={profile.role}
            demo={isDemoMode}
            redirectTo="/admin"
          />
        </div>
      ) : null}

      <LiveSummaryCards holdings={holdings} realizedPL={summary.realizedPL} />

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
            <CardHeader className="flex-row items-center gap-3">
              <IconChip accent="amber" size="sm">
                <Star />
              </IconChip>
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
            <CardHeader className="flex-row items-center gap-3">
              <IconChip accent="rose" size="sm">
                <Bell />
              </IconChip>
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
