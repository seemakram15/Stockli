import type { Metadata } from "next";
import { getPortfolio, getSessionUser } from "@/lib/services/portfolio";
import { isDemoMode } from "@/lib/config";
import { CachedPortfolioDetailPage } from "@/components/portfolio/cached-portfolio-detail-page";

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
  const user = await getSessionUser();
  return <CachedPortfolioDetailPage id={id} userId={user?.id ?? "anonymous"} demo={isDemoMode} />;
}
