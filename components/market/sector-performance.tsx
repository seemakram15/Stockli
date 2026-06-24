"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import { formatCompact, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SectorPerformance } from "@/lib/services/market";

export function SectorPerformancePanel({
  data,
  showHeader = true,
}: {
  data: SectorPerformance[];
  showHeader?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const marketStats = React.useMemo(() => buildMarketStats(data), [data]);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data]
      .filter((sector) => !q || sector.sector.toLowerCase().includes(q))
      .sort((a, b) => a.sector.localeCompare(b.sector));
  }, [data, query]);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {showHeader ? (
            <div>
              <CardTitle>Sector Performance</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Search sectors and open one to inspect every stock in that group.
              </p>
            </div>
          ) : (
            <p className="max-w-xl text-sm text-muted-foreground">
              Search sectors and open one to inspect every stock in that group.
            </p>
          )}
          <FilterPanel
            title="Sector filters"
            summary={`${filtered.length} sector${filtered.length === 1 ? "" : "s"}`}
            className="w-full sm:max-w-xs"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sectors..."
                className="pl-9"
              />
            </div>
          </FilterPanel>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SectorStat label="Sectors" value={data.length.toLocaleString("en-US")} />
          <SectorStat label="Stocks tracked" value={marketStats.stocks.toLocaleString("en-US")} />
          <SectorStat label="Advancing sectors" value={marketStats.advancing.toLocaleString("en-US")} tone="gain" />
          <SectorStat label="Declining sectors" value={marketStats.declining.toLocaleString("en-US")} tone="loss" />
        </div>
      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            No sectors match your search.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.map((sector) => (
              <SectorCard key={sector.sector} sector={sector} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectorCard({ sector }: { sector: SectorPerformance }) {
  const upPct = sector.count ? (sector.advancers / sector.count) * 100 : 0;
  const downPct = sector.count ? (sector.decliners / sector.count) * 100 : 0;
  const topStocks = sector.stocks.slice(0, 4);
  const positive = sector.avgChangePct >= 0;

  return (
    <Link
      href={`/market/sectors/${encodeURIComponent(sector.sector)}`}
      className="group block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold group-hover:text-primary">
            {sector.sector}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{sector.count} stocks</span>
            <span>
              <span className="font-medium text-gain">{sector.advancers}</span> up
            </span>
            <span>
              <span className="font-medium text-loss">{sector.decliners}</span> down
            </span>
            <span>Vol {formatCompact(sector.volume)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-xl font-bold tabular-nums", plColorClass(sector.avgChangePct))}>
            {formatPercent(sector.avgChangePct)}
          </p>
          <p className="text-xs text-muted-foreground">sector move</p>
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="flex h-full">
          <span className="bg-gain" style={{ width: `${upPct}%` }} />
          <span className="bg-loss" style={{ width: `${downPct}%` }} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Most active movers
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topStocks.map((stock) => (
              <span
                key={stock.symbol}
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                  plColorClass(stock.changePct),
                  stock.changePct > 0
                    ? "bg-gain/10"
                    : stock.changePct < 0
                      ? "bg-loss/10"
                      : "bg-muted"
                )}
              >
                {stock.symbol} {formatPercent(stock.changePct)}
              </span>
            ))}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium",
            positive ? "text-gain" : "text-loss"
          )}
        >
          {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          View stocks
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function SectorStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums [overflow-wrap:anywhere]",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function buildMarketStats(data: SectorPerformance[]) {
  return data.reduce(
    (stats, sector) => {
      stats.stocks += sector.count;
      stats.advancing += sector.avgChangePct > 0 ? 1 : 0;
      stats.declining += sector.avgChangePct < 0 ? 1 : 0;
      return stats;
    },
    { stocks: 0, advancing: 0, declining: 0 }
  );
}
