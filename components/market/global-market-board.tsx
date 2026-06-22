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
        <CardContent className="px-0 sm:px-2">
          <div className="overflow-x-auto scrollbar-thin">
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

function WorldMarketMap({ quotes }: { quotes: GlobalMarketQuote[] }) {
  const markers = quotes.filter((quote) => quote.x != null && quote.y != null);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-2">
        <Globe2 className="size-5 text-primary" />
        <CardTitle>World market heat map</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border bg-[linear-gradient(135deg,#eef7f3_0%,#f4f7ff_48%,#fff7ed_100%)] shadow-inner">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:52px_52px]" />
          <svg
            viewBox="0 0 1000 520"
            className="absolute inset-0 size-full text-slate-500/45"
            role="img"
            aria-label="World map background"
          >
            <path d="M116 154 206 118 294 146 340 191 305 235 234 224 188 251 117 247 63 215z" fill="currentColor" />
            <path d="M245 279 322 260 401 302 382 386 328 480 270 421 236 344z" fill="currentColor" />
            <path d="M420 132 508 108 594 139 600 190 543 218 476 205 414 184z" fill="currentColor" />
            <path d="M545 225 622 198 710 229 760 290 724 357 638 350 557 304z" fill="currentColor" />
            <path d="M672 148 788 121 925 167 872 250 750 231 686 200z" fill="currentColor" />
            <path d="M754 350 880 340 940 409 852 464 744 420z" fill="currentColor" />
            <path d="M515 370 560 396 552 457 502 450 486 401z" fill="currentColor" />
          </svg>
          {markers.map((quote) => (
            <div
              key={quote.symbol}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${quote.x}%`, top: `${quote.y}%` }}
            >
              <div
                className={cn(
                  "whitespace-nowrap rounded-lg border bg-background/95 px-2.5 py-1.5 text-xs font-semibold shadow-sm backdrop-blur",
                  (quote.changePct ?? 0) > 0
                    ? "border-gain/40 text-gain"
                    : (quote.changePct ?? 0) < 0
                      ? "border-loss/40 text-loss"
                      : "border-border text-muted-foreground"
                )}
              >
                <span>{countryCode(quote.country ?? quote.symbol)}</span>
                <span className="ml-1 tabular-nums">{formatPercent(quote.changePct, 1)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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
