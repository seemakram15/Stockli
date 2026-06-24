import type { Metadata } from "next";
import { CachedDashboardPage } from "@/components/dashboard/cached-dashboard-page";
import { getSessionUser } from "@/lib/services/portfolio";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  return <CachedDashboardPage userId={user?.id ?? "anonymous"} />;
}
