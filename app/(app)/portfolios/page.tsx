import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { getDashboard } from "@/lib/services/portfolio";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { CreatePortfolioDialog } from "@/components/portfolio/create-portfolio-dialog";
import { LivePortfolioGrid } from "@/components/portfolio/live-portfolio-grid";

export const metadata: Metadata = { title: "Portfolios" };
export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  const { portfolios, holdings } = await getDashboard();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Portfolios"
        description="Group your positions and track each one's performance."
        actions={<CreatePortfolioDialog />}
      />

      {portfolios.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-6" />}
          title="No portfolios yet"
          description="Create your first portfolio to start adding holdings."
          action={<CreatePortfolioDialog />}
        />
      ) : (
        <LivePortfolioGrid portfolios={portfolios} holdings={holdings} />
      )}
    </div>
  );
}
