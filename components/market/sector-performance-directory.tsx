"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { ChangeBadge } from "@/components/change-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCompact, formatPKR, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SectorPerformance, SectorStockPerformance } from "@/lib/services/market";

const SECTOR_PRIORITY: string[] = [
  "Commercial Banks",
  "Oil & Gas Exploration Companies",
  "Fertilizer",
  "Cement",
  "Power Generation & Distribution",
  "Technology & Communication",
  "Automobile Assembler",
  "Textile Composite",
  "Food & Personal Care Products",
  "Pharmaceutical",
  "Refinery",
  "Engineering",
  "Insurance",
  "Investment Banks / Investment Companies / Securities Companies",
  "Chemicals",
  "Leasing Companies",
  "Modarabas",
  "Paper & Board",
  "Sugar & Allied Industries",
  "Textile Spinning",
  "Vanaspati & Allied Industries",
  "Woollen",
];

function sectorSortKey(sector: SectorPerformance): [number, number] {
  const priority = SECTOR_PRIORITY.indexOf(sector.sector);
  return [priority === -1 ? 999 : priority, -sector.avgChangePct];
}

export function SectorPerformanceDirectory({
  data,
}: {
  data: SectorPerformance[];
  selectedIndex?: string | null;
}) {
  const [query, setQuery] = React.useState("");
  const [selectedSector, setSelectedSector] = React.useState("all");
  const [expandedStock, setExpandedStock] = React.useState<string | null>(null);

  const allSectors = React.useMemo(() => {
    return [...data].sort((a, b) => {
      const [pa] = sectorSortKey(a);
      const [pb] = sectorSortKey(b);
      return pa !== pb ? pa - pb : a.sector.localeCompare(b.sector);
    });
  }, [data]);

  const visibleSectors = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data
      .map((sector) => {
        if (selectedSector !== "all" && sector.sector !== selectedSector) return null;
        if (!q) return sector;
        if (sector.sector.toLowerCase().includes(q)) return sector;
        const stocks = sector.stocks.filter((s) => s.symbol.toLowerCase().includes(q));
        if (stocks.length === 0) return null;
        return buildVisibleSector(sector, stocks);
      })
      .filter(Boolean) as SectorPerformance[];
    return [...filtered].sort((a, b) => {
      const [pa, sa] = sectorSortKey(a);
      const [pb, sb] = sectorSortKey(b);
      return pa !== pb ? pa - pb : sa - sb;
    });
  }, [data, query, selectedSector]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a sector or stock symbol..."
            className="pl-9"
          />
        </div>
        <Select value={selectedSector} onValueChange={setSelectedSector}>
          <SelectTrigger className="w-[180px] shrink-0">
            <SelectValue placeholder="All sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sectors</SelectItem>
            {allSectors.map((s) => (
              <SelectItem key={s.sector} value={s.sector}>
                {s.sector}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Company</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last Close</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Open</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">High</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Low</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Price</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Change</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Change %</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Volume</th>
            </tr>
          </thead>
          <tbody>
            {visibleSectors.map((sector) => (
              <React.Fragment key={sector.sector}>
                <tr className="bg-[#2563EB] dark:bg-[#1D4ED8]">
                  <td colSpan={9} className="px-4 py-2.5">
                    <div className="relative flex items-center justify-center">
                      <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow">
                        {sector.sector}
                      </span>
                      <span className="absolute right-0 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                        {sector.count} stocks
                      </span>
                    </div>
                  </td>
                </tr>
                {sector.stocks.map((stock, i) => {
                  const company = stock.name;
                  return (
                    <tr
                      key={stock.symbol}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/40",
                        i % 2 === 1 && "bg-muted/10"
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <Link href={`/stock/${stock.symbol}`} className="group flex flex-col hover:text-primary">
                          {company ? (
                            <>
                              <span className="font-semibold">{company}</span>
                              <span className="text-[11px] text-muted-foreground">{stock.symbol}</span>
                            </>
                          ) : (
                            <span className="font-semibold">{stock.symbol}</span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {stock.ldcp != null ? formatPKR(stock.ldcp) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {stock.open != null ? formatPKR(stock.open) : "—"}
                      </td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums", stock.high != null ? "text-gain" : "text-muted-foreground")}>
                        {stock.high != null ? formatPKR(stock.high) : "—"}
                      </td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums", stock.low != null ? "text-loss" : "text-muted-foreground")}>
                        {stock.low != null ? formatPKR(stock.low) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {formatPKR(stock.price)}
                      </td>
                      <td className={cn("px-4 py-2.5 text-right tabular-nums", plColorClass(stock.change))}>
                        {formatPKR(stock.change, { sign: true })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ChangeBadge pct={stock.changePct} className="justify-end" />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatCompact(stock.volume)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="space-y-3 md:hidden">
        {visibleSectors.map((sector) => (
          <div key={sector.sector} className="overflow-hidden rounded-xl border border-border">
            <div className="relative flex items-center justify-center bg-[#2563EB] px-4 py-3 dark:bg-[#1D4ED8]">
              <span className="text-sm font-bold uppercase tracking-wider text-white drop-shadow">
                {sector.sector}
              </span>
              <span className="absolute right-4 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
                {sector.count} stocks
              </span>
            </div>
            <div className="divide-y divide-border">
              {sector.stocks.map((stock) => {
                const key = `${sector.sector}||${stock.symbol}`;
                const isOpen = expandedStock === key;
                return (
                  <div key={stock.symbol}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                      onClick={() => setExpandedStock(isOpen ? null : key)}
                    >
                      <span className="min-w-0 flex-1 text-sm font-semibold tabular-nums">{stock.symbol}</span>
                      <span className="shrink-0 tabular-nums text-sm font-semibold">{formatPKR(stock.price)}</span>
                      <ChangeBadge pct={stock.changePct} />
                      {isOpen
                        ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                        : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      }
                    </button>
                    {isOpen && (
                      <div className="grid grid-cols-3 gap-y-4 border-t border-border bg-muted/30 px-4 py-4">
                        <DetailCell label="Last Close" value={stock.ldcp != null ? formatPKR(stock.ldcp) : "—"} />
                        <DetailCell label="Open" value={stock.open != null ? formatPKR(stock.open) : "—"} />
                        <DetailCell label="High" value={stock.high != null ? formatPKR(stock.high) : "—"} colorClass="text-gain" />
                        <DetailCell label="Low" value={stock.low != null ? formatPKR(stock.low) : "—"} colorClass="text-loss" />
                        <DetailCell
                          label="Change"
                          value={formatPKR(stock.change, { sign: true })}
                          colorClass={plColorClass(stock.change)}
                        />
                        <DetailCell label="Volume" value={formatCompact(stock.volume)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailCell({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 tabular-nums text-sm font-medium", colorClass)}>{value}</p>
    </div>
  );
}

function buildVisibleSector(sector: SectorPerformance, stocks: SectorStockPerformance[]) {
  const count = stocks.length;
  const advancers = stocks.filter((s) => s.changePct > 0).length;
  const decliners = stocks.filter((s) => s.changePct < 0).length;
  const volume = stocks.reduce((sum, s) => sum + s.volume, 0);
  const avgChangePct = count
    ? stocks.reduce((sum, s) => sum + s.changePct, 0) / count
    : 0;
  return { ...sector, count, advancers, decliners, volume, avgChangePct, stocks };
}
