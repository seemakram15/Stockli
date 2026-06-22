import type { Metadata } from "next";
import {
  getIndexCards,
  getIndexDetail,
  getMarketAnalytics,
} from "@/lib/services/market";
import { marketStatus } from "@/lib/psx/market-hours";
import { PageHeader } from "@/components/page-header";
import { IndicesPanel } from "@/components/market/indices-panel";
import { MarketPerformers } from "@/components/market/market-performers";
import { SectorPerformancePanel } from "@/components/market/sector-performance";
import { ConstituentsTable } from "@/components/market/constituents-table";
import { MarketStatusBadge } from "@/components/status-badges";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Market" };
export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const [cards, detail, analytics] = await Promise.all([
    getIndexCards(),
    getIndexDetail("KSE100"),
    getMarketAnalytics(),
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

      <MarketPerformers data={analytics.performers} />

      {detail && (
        <Card>
          <CardHeader className="flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{detail.symbol} constituents ({detail.constituents.length})</CardTitle>
            <span className="text-xs text-muted-foreground">Sorted by index weight</span>
          </CardHeader>
          <CardContent>
            <ConstituentsTable constituents={detail.constituents} />
          </CardContent>
        </Card>
      )}

      <SectorPerformancePanel data={analytics.sectors} />
    </div>
  );
}
