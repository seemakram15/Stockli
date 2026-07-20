"use client";

import * as React from "react";
import { ArrowDownUp, Globe2, Search, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Link from "next/link";
import { IconChip, type Accent } from "@/components/ui/accent";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WorldMarketHeatMap } from "@/components/market/world-market-heat-map";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCompact,
  formatMarketPrice,
  formatPercent,
  formatSigned,
  plColorClass,
  timeAgo,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GlobalMarketData, GlobalMarketQuote } from "@/lib/services/global-markets";

type SortKey = "name" | "price" | "changePct" | "volume" | "type" | "country" | "priority";

export function GlobalMarketBoard({
  data,
  showMap = false,
  accent = "indigo",
  hideSummaryStats = false,
  sectionTitle = "Markets",
  sectionDescription,
  useTableOnMobile = false,
  rowNoun = "market",
  prioritySymbols,
}: {
  data: GlobalMarketData;
  showMap?: boolean;
  accent?: Accent;
  hideSummaryStats?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  useTableOnMobile?: boolean;
  rowNoun?: string;
  prioritySymbols?: string[];
}) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>(prioritySymbols ? "priority" : "changePct");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const types = React.useMemo(
    () => unique(data.quotes.map((quote) => quote.type).filter(Boolean)),
    [data.quotes]
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.quotes
      .filter((quote) => {
        const matchesQuery =
          !q ||
          quote.symbol.toLowerCase().includes(q) ||
          quote.name.toLowerCase().includes(q) ||
          quote.type.toLowerCase().includes(q) ||
          quote.country?.toLowerCase().includes(q);
        const matchesType = type === "all" || quote.type === type;
        return matchesQuery && matchesType;
      })
      .sort((a, b) => compareQuotes(a, b, sortKey, sortDir, prioritySymbols));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.quotes, query, sortDir, sortKey, type, prioritySymbols]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "country" || key === "type" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-4">
      {!hideSummaryStats ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Average move"
            value={formatPercent(data.summary.avgChangePct)}
            tone={toneFor(data.summary.avgChangePct)}
            accent={accent}
            icon={<Globe2 className="size-4" />}
          />
          <StatCard
            label="Advancers"
            value={String(data.summary.advancers)}
            tone="gain"
            accent="emerald"
            icon={<TrendingUp className="size-4" />}
          />
          <StatCard
            label="Decliners"
            value={String(data.summary.decliners)}
            tone="loss"
            accent="rose"
            icon={<TrendingDown className="size-4" />}
          />
          <StatCard
            label="Best move"
            value={data.summary.best ? `${shortMarketLabel(data.summary.best)} ${formatPercent(data.summary.best.changePct)}` : "—"}
            tone={toneFor(data.summary.best?.changePct)}
            accent="violet"
            icon={<Trophy className="size-4" />}
          />
        </div>
      ) : null}

      {showMap && <WorldMarketHeatMap data={data} />}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <IconChip accent={accent} variant="gradient"><Globe2 /></IconChip>
              <div>
                <CardTitle>{sectionTitle}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sectionDescription ?? data.sourceLabel}
                </p>
              </div>
            </div>
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Source
            </a>
          </div>

          <div className="flex gap-2">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search symbol, country..."
                className="pl-9"
              />
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="sm:w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {types.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "pb-4",
            useTableOnMobile ? "px-0" : "px-3 sm:px-2"
          )}
        >
          {!useTableOnMobile ? (
            <div className="space-y-3 sm:hidden">
              {rows.map((quote) => (
                <MarketMobileCard
                  key={`${quote.symbol}-mobile`}
                  quote={quote}
                  universe={data.universe}
                />
              ))}
              {rows.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                  No markets match the current filters.
                </div>
              ) : null}
            </div>
          ) : null}
          <div className={cn("overflow-x-auto scrollbar-thin", useTableOnMobile ? "" : "hidden sm:block")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Market" active={sortKey === "name"} onClick={() => toggleSort("name")} />
                  <SortableHead label="Type" active={sortKey === "type"} onClick={() => toggleSort("type")} />
                  <SortableHead label="Country" active={sortKey === "country"} onClick={() => toggleSort("country")} />
                  <SortableHead label="Price" active={sortKey === "price"} onClick={() => toggleSort("price")} align="right" />
                  <SortableHead label="Change" active={sortKey === "changePct"} onClick={() => toggleSort("changePct")} align="right" />
                  <SortableHead label="Volume" active={sortKey === "volume"} onClick={() => toggleSort("volume")} align="right" />
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((quote) => (
                  <TableRow key={quote.symbol}>
                    <TableCell>
                      <div>
                        {indexHref(data.universe, quote) ? (
                          <Link
                            href={indexHref(data.universe, quote)!}
                            className="block max-w-64 truncate font-semibold hover:text-primary"
                          >
                            {quote.name}
                          </Link>
                        ) : (
                          <p className="max-w-64 truncate font-semibold">{quote.name}</p>
                        )}
                        <p className="max-w-64 truncate text-xs text-muted-foreground">
                          {displayTicker(quote)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{quote.type}</div>
                      {quote.trendRank ? (
                        <div className="text-xs text-muted-foreground">
                          Trending #{quote.trendRank}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{quote.country ?? quote.region ?? "Global"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMarketPrice(quote.price, quote.currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={cn("font-semibold tabular-nums", plColorClass(quote.changePct))}>
                        {formatPercent(quote.changePct)}
                      </div>
                      <div className={cn("text-xs tabular-nums", plColorClass(quote.change))}>
                        {formatSigned(quote.change)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompact(quote.volume)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {timeAgo(quote.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                      No markets match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MarketMobileCard({
  quote,
  universe,
}: {
  quote: GlobalMarketQuote;
  universe: GlobalMarketData["universe"];
}) {
  const href = indexHref(universe, quote);
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="block truncate font-semibold hover:text-primary">
              {quote.name}
            </Link>
          ) : (
            <p className="truncate font-semibold">{quote.name}</p>
          )}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {displayTicker(quote)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums">
            {formatMarketPrice(quote.price, quote.currency)}
          </p>
          <p className={cn("text-xs font-semibold tabular-nums", plColorClass(quote.changePct))}>
            {formatPercent(quote.changePct)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <MobileMarketMetric label="Type" value={quote.type} />
        <MobileMarketMetric label="Change" value={formatSigned(quote.change)} tone={quote.change} />
        <MobileMarketMetric label="Volume" value={formatCompact(quote.volume)} align="right" />
      </div>
      <p className="mt-3 text-right text-xs text-muted-foreground">
        Updated {timeAgo(quote.updatedAt)}
      </p>
    </div>
  );
}

function MobileMarketMetric({
  label,
  value,
  tone,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  tone?: number | null;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", tone == null ? "" : plColorClass(tone))}>
        {value}
      </p>
    </div>
  );
}


function toneFor(value: number | null | undefined): "gain" | "loss" | "default" {
  if (value == null || Number.isNaN(value)) return "default";
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "default";
}

function SortableHead({
  label,
  active,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-foreground",
          align === "right" && "justify-end"
        )}
      >
        {label}
        <ArrowDownUp className={cn("size-3", active ? "text-primary" : "text-muted-foreground")} />
      </button>
    </TableHead>
  );
}

function compareQuotes(
  a: GlobalMarketQuote,
  b: GlobalMarketQuote,
  key: SortKey,
  dir: "asc" | "desc",
  prioritySymbols?: string[]
) {
  if (key === "priority" && prioritySymbols) {
    const ai = prioritySymbols.indexOf(a.symbol);
    const bi = prioritySymbols.indexOf(b.symbol);
    const ap = ai === -1 ? prioritySymbols.length : ai;
    const bp = bi === -1 ? prioritySymbols.length : bi;
    return ap - bp;
  }
  const factor = dir === "asc" ? 1 : -1;
  if (key === "name") return a.name.localeCompare(b.name) * factor;
  if (key === "type") return a.type.localeCompare(b.type) * factor;
  if (key === "country") return (a.country ?? "").localeCompare(b.country ?? "") * factor;
  const av = numericSortValue(a, key);
  const bv = numericSortValue(b, key);
  return (av - bv) * factor;
}

function numericSortValue(quote: GlobalMarketQuote, key: SortKey) {
  if (key === "price") return quote.price ?? -Infinity;
  if (key === "changePct") return quote.changePct ?? -Infinity;
  if (key === "volume") return quote.volume ?? -Infinity;
  return 0;
}

function unique(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function displayTicker(quote: GlobalMarketQuote) {
  return getMarketDisplaySymbol(quote.symbol, quote.displaySymbol);
}

function shortMarketLabel(quote: GlobalMarketQuote) {
  if (quote.type === "Crypto") return quote.symbol;
  return getMarketDisplaySymbol(quote.symbol, quote.displaySymbol);
}

function indexHref(universe: GlobalMarketData["universe"], quote: GlobalMarketQuote) {
  if (quote.type !== "Index") return null;
  return `/market/${universe}/index/${encodeURIComponent(quote.symbol)}`;
}
