"use client";

import * as React from "react";
import { ArrowDownUp, Globe2, Search } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type SortKey = "name" | "price" | "changePct" | "volume" | "type" | "country";

export function GlobalMarketBoard({
  data,
  showMap = false,
}: {
  data: GlobalMarketData;
  showMap?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [region, setRegion] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("changePct");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const types = React.useMemo(
    () => unique(data.quotes.map((quote) => quote.type).filter(Boolean)),
    [data.quotes]
  );
  const regions = React.useMemo(
    () => unique(data.quotes.map((quote) => quote.region).filter(Boolean) as string[]),
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
        const matchesRegion = region === "all" || quote.region === region;
        return matchesQuery && matchesType && matchesRegion;
      })
      .sort((a, b) => compareQuotes(a, b, sortKey, sortDir));
  }, [data.quotes, query, region, sortDir, sortKey, type]);

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Average move" value={formatPercent(data.summary.avgChangePct)} tone={data.summary.avgChangePct} />
        <MetricCard label="Advancers" value={String(data.summary.advancers)} tone={1} />
        <MetricCard label="Decliners" value={String(data.summary.decliners)} tone={-1} />
        <MetricCard
          label="Best move"
          value={data.summary.best ? `${shortMarketLabel(data.summary.best)} ${formatPercent(data.summary.best.changePct)}` : "—"}
          tone={data.summary.best?.changePct}
        />
      </div>

      {showMap && <WorldMarketMap quotes={data.quotes} />}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Markets</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.sourceLabel}
              </p>
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

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="relative sm:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search symbol, country..."
                className="pl-9"
              />
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
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
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger>
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-4 sm:px-2">
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
          <div className="hidden overflow-x-auto scrollbar-thin sm:block">
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

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <MobileMarketMetric label="Type" value={quote.type} />
        <MobileMarketMetric label="Country" value={quote.country ?? quote.region ?? "Global"} align="right" />
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

function WorldMarketMap({ quotes }: { quotes: GlobalMarketQuote[] }) {
  const markers = quotes.filter((quote) => quote.x != null && quote.y != null);
  const regions = regionSummary(markers);
  const gainers = topMoved(markers, "gain");
  const decliners = topMoved(markers, "loss");

  return (
    <Card className="overflow-hidden border-primary/15">
      <CardHeader className="border-b border-border bg-gradient-to-br from-card via-card to-primary/5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Globe2 className="size-5 text-primary" />
            <CardTitle>World market heat map</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Major country indices by one-day move</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-emerald-500/15 bg-[#07130f] shadow-inner">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_22%,rgba(16,185,129,0.22),transparent_24%),radial-gradient(circle_at_78%_35%,rgba(59,130,246,0.16),transparent_25%),linear-gradient(135deg,rgba(6,18,15,0.96),rgba(12,28,31,0.98))]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] bg-[size:44px_44px]" />
            <svg
              viewBox="0 0 1000 520"
              className="absolute inset-0 size-full text-white/10"
              role="img"
              aria-label="Stylized world map"
            >
              <path d="M86 158 192 103 313 134 369 190 326 249 238 235 181 277 83 257 39 211z" fill="currentColor" />
              <path d="M250 293 354 267 429 318 398 407 337 487 277 423 225 349z" fill="currentColor" />
              <path d="M422 127 516 99 619 132 641 188 569 232 474 212 398 179z" fill="currentColor" />
              <path d="M554 235 638 197 746 240 792 308 745 379 636 363 553 312z" fill="currentColor" />
              <path d="M669 145 802 114 944 169 886 260 743 237 676 199z" fill="currentColor" />
              <path d="M748 360 881 345 953 419 851 478 735 427z" fill="currentColor" />
              <path d="M505 367 566 399 556 466 493 450 475 399z" fill="currentColor" />
            </svg>

            <div className="absolute left-5 top-5 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-white/55">Global breadth</p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-emerald-300">{markers.filter((quote) => (quote.changePct ?? 0) > 0).length} up</span>
                <span className="text-red-300">{markers.filter((quote) => (quote.changePct ?? 0) < 0).length} down</span>
              </div>
            </div>

            {markers.map((quote) => (
              <div
                key={quote.symbol}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${quote.x}%`, top: `${quote.y}%` }}
              >
                <span
                  className={cn(
                    "absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-sm",
                    heatTone(quote.changePct, "glow")
                  )}
                />
                <div
                  className={cn(
                    "relative z-10 flex min-w-16 flex-col items-center rounded-xl border px-2.5 py-1.5 text-center text-xs font-semibold shadow-lg backdrop-blur",
                    heatTone(quote.changePct, "chip")
                  )}
                >
                  <span className="leading-none">{countryCode(quote.country ?? quote.symbol)}</span>
                  <span className="mt-1 tabular-nums">{formatPercent(quote.changePct, 1)}</span>
                </div>
                <div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 hidden w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950/95 p-3 text-left text-xs text-white shadow-2xl group-hover:block">
                  <p className="font-semibold">{quote.name}</p>
                  <p className="mt-1 text-white/60">{quote.country ?? quote.region ?? "Global"}</p>
                  <p className={cn("mt-2 font-bold tabular-nums", plColorClass(quote.changePct))}>
                    {formatPercent(quote.changePct)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-background p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Regional breadth</h3>
              <div className="mt-3 space-y-2">
                {regions.map((region) => (
                  <div key={region.name} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{region.name}</p>
                      <span className={cn("font-semibold tabular-nums", plColorClass(region.avg))}>
                        {formatPercent(region.avg, 1)}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                      <span className="text-gain">{region.up} up</span>
                      <span>{region.flat} flat</span>
                      <span className="text-loss">{region.down} down</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <MoveList title="Top gainers" rows={gainers} />
            <MoveList title="Top decliners" rows={decliners} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MoveList({ title, rows }: { title: string; rows: GlobalMarketQuote[] }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map((quote) => (
          <div key={`${title}-${quote.symbol}`} className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{quote.name}</p>
              <p className="text-xs text-muted-foreground">{quote.country ?? quote.region ?? quote.symbol}</p>
            </div>
            <p className={cn("font-semibold tabular-nums", plColorClass(quote.changePct))}>
              {formatPercent(quote.changePct, 1)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function regionSummary(quotes: GlobalMarketQuote[]) {
  const groups = new Map<string, GlobalMarketQuote[]>();
  for (const quote of quotes) {
    const key = quote.region ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), quote]);
  }

  return Array.from(groups.entries())
    .map(([name, rows]) => {
      const priced = rows.filter((row) => row.changePct != null);
      const avg = priced.length
        ? priced.reduce((sum, row) => sum + (row.changePct ?? 0), 0) / priced.length
        : 0;
      const up = priced.filter((row) => (row.changePct ?? 0) > 0).length;
      const down = priced.filter((row) => (row.changePct ?? 0) < 0).length;
      return {
        name,
        avg,
        up,
        down,
        flat: Math.max(0, priced.length - up - down),
      };
    })
    .sort((a, b) => Math.abs(b.avg) - Math.abs(a.avg));
}

function topMoved(quotes: GlobalMarketQuote[], direction: "gain" | "loss") {
  const priced = quotes.filter((quote) => quote.changePct != null);
  return priced
    .sort((a, b) =>
      direction === "gain"
        ? (b.changePct ?? 0) - (a.changePct ?? 0)
        : (a.changePct ?? 0) - (b.changePct ?? 0)
    )
    .slice(0, 4);
}

function heatTone(value: number | null, part: "chip" | "glow") {
  const current = value ?? 0;
  if (current > 0) {
    return part === "glow"
      ? "bg-emerald-400"
      : "border-emerald-300/50 bg-emerald-400/15 text-emerald-100";
  }
  if (current < 0) {
    return part === "glow"
      ? "bg-red-400"
      : "border-red-300/50 bg-red-400/15 text-red-100";
  }
  return part === "glow"
    ? "bg-slate-300"
    : "border-white/20 bg-white/10 text-white";
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number | null;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold tabular-nums", plColorClass(tone))}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
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
  dir: "asc" | "desc"
) {
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
  const clean = quote.displaySymbol ?? friendlyTicker(quote.symbol);
  if (quote.symbol.includes("=")) {
    return `${clean} · ${quote.symbol.replace(/=F$/i, "")} futures`;
  }
  if (quote.symbol.startsWith("^")) return `${clean} · ${quote.country ?? quote.region ?? "Global"}`;
  return `${quote.symbol}${quote.country ? ` · ${quote.country}` : ""}`;
}

function shortMarketLabel(quote: GlobalMarketQuote) {
  if (quote.type === "Crypto") return quote.symbol;
  return quote.symbol.includes("=") || quote.symbol.startsWith("^")
    ? quote.displaySymbol ?? friendlyTicker(quote.symbol)
    : quote.symbol;
}

function friendlyTicker(symbol: string) {
  const map: Record<string, string> = {
    "CL=F": "WTI",
    "BZ=F": "Brent",
    "NG=F": "Nat Gas",
    "RB=F": "RBOB",
    "HO=F": "Heating Oil",
    "GC=F": "Gold",
    "SI=F": "Silver",
    "HG=F": "Copper",
    "PL=F": "Platinum",
    "PA=F": "Palladium",
    "ZC=F": "Corn",
    "ZW=F": "Wheat",
    "ZS=F": "Soybeans",
    "KC=F": "Coffee",
    "CT=F": "Cotton",
    "SB=F": "Sugar",
    "^GSPC": "S&P 500",
    "^DJI": "Dow",
    "^NDX": "Nasdaq 100",
    "^IXIC": "Nasdaq Composite",
    "^NSEI": "NIFTY",
    "^BSESN": "SENSEX",
    "^NSEBANK": "NIFTY Bank",
  };
  return map[symbol] ?? symbol.replace(/^\^/, "").replace(/=F$/, "");
}

function indexHref(universe: GlobalMarketData["universe"], quote: GlobalMarketQuote) {
  if (quote.type !== "Index") return null;
  return `/market/${universe}/index/${encodeURIComponent(quote.symbol)}`;
}

function countryCode(country: string) {
  const map: Record<string, string> = {
    Australia: "AUS",
    Brazil: "BRA",
    Canada: "CAN",
    China: "CHN",
    Egypt: "EGY",
    France: "FRA",
    Germany: "GER",
    "Hong Kong": "HKG",
    India: "IND",
    Israel: "ISR",
    Italy: "ITA",
    Japan: "JPN",
    Mexico: "MEX",
    "South Africa": "ZAF",
    "South Korea": "KOR",
    "United Kingdom": "UK",
    "United States": "US",
  };
  return map[country] ?? country;
}
