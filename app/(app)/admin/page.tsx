import type { Metadata } from "next";
import { Users, Wallet, Layers, ShieldCheck } from "lucide-react";
import { listUsers, getPlatformStats } from "@/lib/services/admin";
import { getSessionUser } from "@/lib/services/portfolio";
import { isDemoMode } from "@/lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { AdminUsersTable } from "@/components/admin/admin-users-table";
import { BroadcastNotificationForm } from "@/components/admin/broadcast-notification-form";
import { formatPKR, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, users, me] = await Promise.all([
    getPlatformStats(),
    listUsers(),
    getSessionUser(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" /> Admin
          </span>
        }
        description="Platform overview and every user's account. Superadmin only."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Users" value={formatNumber(stats.userCount, 0)} icon={<Users className="size-4" />} />
        <StatCard label="Portfolios" value={formatNumber(stats.portfolioCount, 0)} icon={<Layers className="size-4" />} />
        <StatCard label="Holdings" value={formatNumber(stats.holdingCount, 0)} icon={<Wallet className="size-4" />} />
        <StatCard
          label="Total AUM (all users)"
          value={formatPKR(stats.totalValue)}
          icon={<Wallet className="size-4" />}
          sub={<span className="text-muted-foreground">{stats.superadminCount} superadmin(s)</span>}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Broadcast notification</CardTitle>
          <p className="text-sm text-muted-foreground">
            Send a system, market, portfolio, or alert notice to every user. Push delivery follows each user&apos;s device consent.
          </p>
        </CardHeader>
        <CardContent>
          <BroadcastNotificationForm demo={isDemoMode} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent className="px-0 sm:px-2">
          <AdminUsersTable users={users} currentUserId={me?.id ?? ""} demo={isDemoMode} />
        </CardContent>
      </Card>
    </div>
  );
}
