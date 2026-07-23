import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Activity, BarChart3, Flame, Layers, TrendingDown, TrendingUp } from "lucide-react";
import {
  getMarketSectorIndexLabel,
  normalizeMarketSectorIndex,
} from "@/lib/psx/market-indexes";
import { getSectorPerformance } from "@/lib/services/market";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { SectorStocksTable } from "@/components/market/sector-stocks-table";
import { StatCard } from "@/components/stat-card";
import { DataDelayBadge } from "@/components/status-badges";
import { IconChip } from "@/components/ui/accent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompact, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buildPageMetadata } from "@/lib/seo";

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
  const sectorName = decodeParam(sector);
  const label = selectedIndex ? ` · ${getMarketSectorIndexLabel(selectedIndex)}` : "";
  const title = `${sectorName} sector${label}`;
  return buildPageMetadata({
    title,
    description: `Live ${sectorName} sector performance, leaders and laggards on the Pakistan Stock Exchange.`,
    path: `/market/sectors/${encodeURIComponent(sector)}`,
    keywords: [sectorName, `${sectorName} PSX sector`, "Pakistan sector performance"],
  });
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
        icon={<BarChart3 />}
        eyebrow="Sector detail"
        accent="teal"
        title={sector.sector}
        description={description}
        actions={<DataDelayBadge />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<BarChart3 className="size-4" />}
          label="Sector move"
          value={formatPercent(sector.avgChangePct)}
          tone={toneOf(sector.avgChangePct)}
          accent="teal"
        />
        <StatCard
          icon={<Activity className="size-4" />}
          label="Total volume"
          value={formatCompact(sector.volume)}
          accent="sky"
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Advancers"
          value={sector.advancers.toLocaleString("en-US")}
          sub={<span className="text-muted-foreground">{sector.count} total stocks</span>}
          tone="gain"
          accent="emerald"
        />
        <StatCard
          icon={<TrendingDown className="size-4" />}
          label="Decliners"
          value={sector.decliners.toLocaleString("en-US")}
          sub={flat > 0 ? <span className="text-muted-foreground">{flat} flat</span> : undefined}
          tone="loss"
          accent="rose"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="teal" variant="gradient"><Layers /></IconChip>
            <CardTitle>All stocks ({sector.stocks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <SectorStocksTable stocks={sector.stocks} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="orange" variant="gradient"><Flame /></IconChip>
            <CardTitle>Most active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mostActive.map((stock) => (
              <div key={stock.symbol} className="rounded-xl border border-border bg-muted/15 p-3 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
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

function toneOf(value: number): "gain" | "loss" | "default" {
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "default";
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
