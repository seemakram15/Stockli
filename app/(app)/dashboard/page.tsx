import type { Metadata } from "next";
import { MarketHubDashboard } from "@/components/dashboard/market-hub-dashboard";
import { getSessionUser } from "@/lib/services/portfolio";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  return <MarketHubDashboard userId={user?.id ?? "anonymous"} />;
}
