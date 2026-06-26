import type { Metadata } from "next";
import { MarketHubDashboard } from "@/components/dashboard/market-hub-dashboard";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return <MarketHubDashboard />;
}
