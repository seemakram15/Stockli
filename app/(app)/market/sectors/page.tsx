import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { SectorPerformanceDirectory } from "@/components/market/sector-performance-directory";
import { DataDelayBadge } from "@/components/status-badges";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getMarketSectorIndexLabel,
  MARKET_SECTOR_INDEXES,
  normalizeMarketSectorIndex,
} from "@/lib/psx/market-indexes";
import { getSectorPerformance } from "@/lib/services/market";

export const metadata: Metadata = { title: "Sector Performance" };
export const dynamic = "force-dynamic";

export default async function SectorPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ index?: string }>;
}) {
  const { index } = await searchParams;
  const selectedIndex = normalizeMarketSectorIndex(index) ?? "KSE100";
  const selectedLabel = getMarketSectorIndexLabel(selectedIndex);
  const sectors = await getSectorPerformance(selectedIndex);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref="/market" label="Back to market" />

      <PageHeader
        title="Sector Performance"
        description={`Choose an index to group its stocks by sector. ${selectedLabel} is currently selected.`}
        actions={<DataDelayBadge />}
      />

      <Card className="overflow-hidden border-primary/20 bg-background shadow-sm">
        <CardContent className="flex flex-wrap gap-2 p-3 sm:p-4">
          {MARKET_SECTOR_INDEXES.map((option) => {
            const active = option.symbol === selectedIndex;
            const href = `/market/sectors?index=${option.symbol}`;
            return (
              <Link
                key={option.symbol}
                href={href}
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {sectors.length ? (
        <SectorPerformanceDirectory data={sectors} selectedIndex={selectedIndex} />
      ) : (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          <BarChart3 className="mr-2 size-4" />
          Sector data is temporarily unavailable.
        </div>
      )}
    </div>
  );
}
