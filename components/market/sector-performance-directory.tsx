"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { ChangeBadge } from "@/components/change-badge";
import { MarketAccordion } from "@/components/market/market-accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompact, formatPKR, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SectorPerformance, SectorStockPerformance } from "@/lib/services/market";

export function SectorPerformanceDirectory({
  data,
  selectedIndex,
}: {
  data: SectorPerformance[];
  selectedIndex?: string | null;
}) {
  const [query, setQuery] = React.useState("");
  const [openSectors, setOpenSectors] = React.useState<Set<string>>(
    () => new Set(data[0]?.sector ? [data[0].sector] : [])
  );

  const visibleSectors = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data
      .map((sector) => {
        if (!q) return sector;
        if (sector.sector.toLowerCase().includes(q)) return sector;

        const stocks = sector.stocks.filter((stock) => stock.symbol.toLowerCase().includes(q));
        if (stocks.length === 0) return null;
        return buildVisibleSector(sector, stocks);
      })
      .filter(Boolean) as SectorPerformance[];

    return [...filtered].sort(
      (a, b) => b.avgChangePct - a.avgChangePct || a.sector.localeCompare(b.sector)
    );
  }, [data, query]);

  const summary = React.useMemo(() => buildSummary(visibleSectors), [visibleSectors]);

  function expandAll() {
    setOpenSectors(new Set(visibleSectors.map((sector) => sector.sector)));
  }

  function closeAll() {
    setOpenSectors(new Set());
  }

  function setSectorOpen(sectorName: string, nextOpen: boolean) {
    setOpenSectors((current) => {
      const next = new Set(current);
      if (nextOpen) next.add(sectorName);
      else next.delete(sectorName);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <FilterPanel
          title="Sector search"
          summary={`${summary.stockCount} stocks across ${summary.sectorCount} sectors`}
          defaultOpen
          className="w-full lg:max-w-2xl"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a sector or stock symbol..."
              className="pl-9"
            />
          </div>
        </FilterPanel>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={closeAll}>
            Close all
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SectorStat label="Sectors" value={summary.sectorCount.toLocaleString("en-US")} />
        <SectorStat label="Stocks tracked" value={summary.stockCount.toLocaleString("en-US")} />
        <SectorStat
          label="Advancing sectors"
          value={summary.advancing.toLocaleString("en-US")}
          tone="gain"
        />
        <SectorStat
          label="Declining sectors"
          value={summary.declining.toLocaleString("en-US")}
          tone="loss"
        />
      </div>

      {visibleSectors.length ? (
        <div className="space-y-3">
          {visibleSectors.map((sector) => (
            <MarketAccordion
              key={sector.sector}
              className="border-emerald-200/70 bg-emerald-50/60 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20"
              summaryClassName="border-emerald-200/60 bg-emerald-50/85 hover:bg-emerald-100/75 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40"
              contentClassName="bg-background/75 dark:bg-transparent"
              title={
                <span className="inline-flex items-center gap-2">
                  <span>{sector.sector}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {sector.count}
                  </span>
                </span>
              }
              meta={
                <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{sector.count} stocks</span>
                  <span>
                    <span className="font-medium text-gain">{sector.advancers}</span> up
                  </span>
                  <span>
                    <span className="font-medium text-loss">{sector.decliners}</span> down
                  </span>
                  <span>Vol {formatCompact(sector.volume)}</span>
                  <span className={cn("font-semibold tabular-nums", plColorClass(sector.avgChangePct))}>
                    {formatPercent(sector.avgChangePct)}
                  </span>
                </span>
              }
              open={openSectors.has(sector.sector)}
              onOpenChange={(nextOpen) => setSectorOpen(sector.sector, nextOpen)}
            >
              <div className="space-y-4">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="flex h-full">
                    <span
                      className="bg-gain"
                      style={{ width: `${Math.max(4, (sector.advancers / Math.max(1, sector.count)) * 100)}%` }}
                    />
                    <span
                      className="bg-loss"
                      style={{ width: `${Math.max(4, (sector.decliners / Math.max(1, sector.count)) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {sector.stocks.slice(0, 4).map((stock) => (
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

                <SectorStocksList stocks={sector.stocks} />

                <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>{sector.count} stocks tracked</span>
                  <span className="inline-flex items-center gap-2">
                    <span>Sector: {sector.sector}</span>
                    <span className="hidden sm:inline">·</span>
                    <Link
                      href={
                        selectedIndex
                          ? `/market/sectors/${encodeURIComponent(sector.sector)}?index=${encodeURIComponent(selectedIndex)}`
                          : `/market/sectors/${encodeURIComponent(sector.sector)}`
                      }
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      View details
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </span>
                </div>
              </div>
            </MarketAccordion>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
            No sectors match the current filters.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectorStocksList({ stocks }: { stocks: SectorStockPerformance[] }) {
  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Volume</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stocks.map((stock) => (
              <TableRow key={stock.symbol} className="group">
                <TableCell>
                  <Link href={`/stock/${stock.symbol}`} className="font-semibold group-hover:text-primary">
                    {stock.symbol}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPKR(stock.price)}</TableCell>
                <TableCell className="text-right">
                  <ChangeBadge
                    value={stock.change}
                    pct={stock.changePct}
                    showValue
                    className="justify-end"
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCompact(stock.volume)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {stocks.map((stock) => (
          <Link
            key={stock.symbol}
            href={`/stock/${stock.symbol}`}
            className="block rounded-xl border border-border bg-background p-3 shadow-sm transition hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{stock.symbol}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">Sector stock</p>
              </div>
              <div className="text-right">
                <p className="font-medium tabular-nums">{formatPKR(stock.price)}</p>
                <ChangeBadge
                  value={stock.change}
                  pct={stock.changePct}
                  showValue
                  className="justify-end text-xs"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Volume" value={formatCompact(stock.volume)} />
              <Metric
                label="Low / High"
                value={`${formatPKR(stock.low)} / ${formatPKR(stock.high)}`}
                align="right"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
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

function Metric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function buildSummary(data: SectorPerformance[]) {
  return data.reduce(
    (stats, sector) => {
      stats.stockCount += sector.count;
      stats.advancing += sector.avgChangePct > 0 ? 1 : 0;
      stats.declining += sector.avgChangePct < 0 ? 1 : 0;
      return stats;
    },
    { sectorCount: data.length, stockCount: 0, advancing: 0, declining: 0 }
  );
}

function buildVisibleSector(sector: SectorPerformance, stocks: SectorStockPerformance[]) {
  const count = stocks.length;
  const advancers = stocks.filter((stock) => stock.changePct > 0).length;
  const decliners = stocks.filter((stock) => stock.changePct < 0).length;
  const volume = stocks.reduce((sum, stock) => sum + stock.volume, 0);
  const avgChangePct = count
    ? stocks.reduce((sum, stock) => sum + stock.changePct, 0) / count
    : 0;

  return {
    ...sector,
    count,
    advancers,
    decliners,
    volume,
    avgChangePct,
    stocks,
  };
}
