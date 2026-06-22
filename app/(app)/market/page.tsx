import type { Metadata } from "next";
import { getIndexCards, getIndexDetail } from "@/lib/services/market";
import { marketStatus } from "@/lib/psx/market-hours";
import { PageHeader } from "@/components/page-header";
import { IndicesPanel } from "@/components/market/indices-panel";
import { MarketStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Market" };
export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const [cards, detail] = await Promise.all([
    getIndexCards(),
    getIndexDetail("KSE100"),
  ]);
  const market = marketStatus();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Market"
        description="Live PSX indices, constituents and index weights."
        actions={<MarketStatusBadge status={market.status} label={market.label} />}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Market Overview</h2>
        {detail ? (
          <IndicesPanel cards={cards} initialDetail={detail} />
        ) : (
          <EmptyState
            icon={<TrendingUp className="size-6" />}
            title="Index data unavailable"
            description="The PSX feed is temporarily unreachable. Please try again shortly."
          />
        )}
      </section>
    </div>
  );
}
