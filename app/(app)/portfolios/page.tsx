import type { Metadata } from "next";
import { CachedPortfolioCommandPage } from "@/components/portfolio/cached-portfolio-command-page";
import { getSessionUser } from "@/lib/services/portfolio";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await getSessionUser();
  return (
    <CachedPortfolioCommandPage
      userId={user?.id ?? "anonymous"}
      title="Portfolio"
      description="Your portfolio command page with holdings, P/L, allocation and daily history."
      showManageAction={false}
    />
  );
}
