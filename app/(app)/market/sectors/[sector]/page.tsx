import type { Metadata } from "next";
import type * as React from "react";
import { notFound } from "next/navigation";
import { Activity, BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import {
  getMarketSectorIndexLabel,
  normalizeMarketSectorIndex,
} from "@/lib/psx/market-indexes";
import { getSectorPerformance } from "@/lib/services/market";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { SectorStocksTable } from "@/components/market/sector-stocks-table";
import { DataDelayBadge } from "@/components/status-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ sector: string }>;
  searchParams: Promise<{ index?: string }>;
}): Promise<Metadata> {
  const { sector } = await params;
  const { index } = await searchParams;
  const selectedIndex = normalizeMarketSectorIndex(index);
  const label = selectedIndex ? ` · ${getMarketSectorIndexLabel(selectedIndex)}` : "";
  return { title: `${decodeParam(sector)} sector${label}` };
}

export default async function MarketSectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ sector: string }>;
  searchParams: Promise<{ index?: string }>;
}) {
  const { sector: rawSector } = await params;
  const { index } = await searchParams;
  const sectorName = decodeParam(rawSector);
  const selectedIndex = normalizeMarketSectorIndex(index);
  const sectors = await getSectorPerformance(selectedIndex);
  const sector = sectors.find((item) => normalize(item.sector) === normalize(sectorName));

  if (!sector) notFound();

  const flat = sector.count - sector.advancers - sector.decliners;
  const mostActive = [...sector.stocks].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const backHref = selectedIndex ? `/market/sectors?index=${selectedIndex}` : "/market/sectors";
  const description = selectedIndex
    ? `Sector-level performance for ${getMarketSectorIndexLabel(selectedIndex)} and every stock currently grouped under this sector.`
    : "Sector-level performance and every stock currently grouped under this sector.";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <SmartBackLink fallbackHref={backHref} label="Back to sectors" />

      <PageHeader
        title={sector.sector}
        description={description}
        actions={<DataDelayBadge />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SectorMetric
          icon={<BarChart3 className="size-4" />}
          label="Sector move"
          value={formatPercent(sector.avgChangePct)}
          tone={sector.avgChangePct}
        />
        <SectorMetric
          icon={<Activity className="size-4" />}
          label="Total volume"
          value={formatCompact(sector.volume)}
        />
        <SectorMetric
          icon={<TrendingUp className="size-4" />}
          label="Advancers"
          value={sector.advancers.toLocaleString("en-US")}
          sub={`${sector.count} total stocks`}
          tone={1}
        />
        <SectorMetric
          icon={<TrendingDown className="size-4" />}
          label="Decliners"
          value={sector.decliners.toLocaleString("en-US")}
          sub={flat > 0 ? `${flat} flat` : undefined}
          tone={-1}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All stocks ({sector.stocks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <SectorStocksTable stocks={sector.stocks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mostActive.map((stock) => (
              <div key={stock.symbol} className="rounded-xl border border-border bg-muted/15 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{stock.symbol}</p>
                    <p className="text-xs text-muted-foreground">Vol {formatCompact(stock.volume)}</p>
                  </div>
                  <p className={cn("text-sm font-semibold tabular-nums", plColorClass(stock.changePct))}>
                    {formatPercent(stock.changePct)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectorMetric({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: number;
}) {
  return (
    <Card>
      <CardContent className="min-w-0 p-3 sm:p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <p className={cn("mt-2 text-lg font-bold tabular-nums [overflow-wrap:anywhere] sm:text-2xl", tone == null ? "" : plColorClass(tone))}>
          {value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function decodeParam(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
