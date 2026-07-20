import * as React from "react";
import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { SectorPerformanceDirectory } from "@/components/market/sector-performance-directory";
import { SectorIndexPicker } from "@/components/market/sector-index-picker";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { DataDelayBadge } from "@/components/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import {
  getMarketSectorIndexLabel,
  MARKET_SECTOR_INDEXES,
  normalizeMarketSectorIndex,
} from "@/lib/psx/market-indexes";
import { getSectorPerformance } from "@/lib/services/market";

export const metadata: Metadata = { title: "Sector Performance" };
export const dynamic = "force-dynamic";

async function SectorData({ selectedIndex }: { selectedIndex: string }) {
  const sectors = await getSectorPerformance(selectedIndex);

  if (!sectors.length) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
        <BarChart3 className="mr-2 size-4" />
        Sector data is temporarily unavailable.
      </div>
    );
  }

  return <SectorPerformanceDirectory data={sectors} selectedIndex={selectedIndex} />;
}

export default async function SectorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ index?: string }>;
}) {
  const { index } = await searchParams;
  const selectedIndex = normalizeMarketSectorIndex(index) ?? "KSE100";
  const selectedLabel = getMarketSectorIndexLabel(selectedIndex);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref="/market" label="Back to market" />

      <PageHeader
        icon={<BarChart3 />}
        eyebrow="Sector performance"
        accent="teal"
        title="Sector Performance"
        description={`Choose an index to group its stocks by sector. ${selectedLabel} is currently selected.`}
        actions={<DataDelayBadge />}
      />

      <Card variant="feature" className="overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          <SectorIndexPicker
            options={MARKET_SECTOR_INDEXES.map((o) => ({ symbol: o.symbol, label: o.label }))}
            selected={selectedIndex}
          />
        </CardContent>
      </Card>

      <React.Suspense
        key={selectedIndex}
        fallback={<PageLoadingState message="Loading sector performance..." variant="sector-list" />}
      >
        <SectorData selectedIndex={selectedIndex} />
      </React.Suspense>
    </div>
  );
}
