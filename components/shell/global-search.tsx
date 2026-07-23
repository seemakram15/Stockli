"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  Bitcoin,
  Boxes,
  Building2,
  Globe2,
  Landmark,
  Layers3,
  LineChart,
  Loader2,
  Search,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouteTransition } from "@/components/navigation/route-transition-provider";
import { StockLogo } from "@/components/stock/stock-logo";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

type SearchMode = "mobile" | "desktop" | "both";
type SearchCategory =
  | "All"
  | "Stocks"
  | "Mutual Funds"
  | "ETFs"
  | "Indexes"
  | "Commodities"
  | "Crypto"
  | "Sectors"
  | "Pages";

type SearchEntry = SearchResult & {
  icon: LucideIcon;
};

type CachedSearch = {
  expiresAt: number;
  results: SearchResult[];
};

const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const SEARCH_CACHE_PREFIX = "stockli:global-search:v1:";
const searchMemoryCache = new Map<string, CachedSearch>();

const FILTERS: SearchCategory[] = [
  "All",
  "Stocks",
  "Mutual Funds",
  "ETFs",
  "Indexes",
  "Commodities",
  "Crypto",
  "Sectors",
  "Pages",
];

const POPULAR_RESULTS: SearchResult[] = [
  popularResult("popular:mari", "stock", "MARI", "Mari Petroleum Co.", "/stock/MARI", "Stocks", "MARI"),
  popularResult("popular:mebl", "stock", "MEBL", "Meezan Bank Limited", "/stock/MEBL", "Stocks", "MEBL"),
  popularResult("popular:kse100", "index", "KSE100", "KSE-100 Index", "/market", "Indexes", "KSE100"),
  popularResult("popular:gold", "commodity", "Gold", "Commodity market snapshot", "/market/commodities", "Commodities", "GC=F"),
  popularResult("popular:bitcoin", "crypto", "Bitcoin", "Crypto market snapshot", "/market/crypto", "Crypto", "BTC"),
  popularResult("popular:cement", "sector", "Cement", "Pakistan Stock Market sector", "/market/sectors/Cement", "Sectors"),
  popularResult("popular:funds", "mutual-fund", "Mutual Funds", "MUFAP funds, AMCs, NAVs and returns", "/market/mutual-funds", "Mutual Funds"),
  popularResult("popular:etfs", "etf", "Exchange Traded Funds", "ETF profiles, holdings and performance", "/market/etfs", "ETFs"),
  popularResult("popular:luck", "stock", "LUCK", "Lucky Cement Limited", "/stock/LUCK", "Stocks", "LUCK"),
  popularResult("popular:ffc", "stock", "FFC", "Fauji Fertilizer Company Limited", "/stock/FFC", "Stocks", "FFC"),
  popularResult("popular:psx", "page", "Pakistan Stock Market", "Stocks, sectors, performers and PSX indexes", "/market", "Pages"),
  popularResult("popular:world", "page", "World View", "Global market heat map and country indexes", "/market/world", "Pages"),
];

export function GlobalSearch({
  className,
  mode = "both",
}: {
  className?: string;
  mode?: SearchMode;
}) {
  const router = useRouter();
  const { beginNavigation } = useRouteTransition();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [resultQuery, setResultQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [category, setCategory] = React.useState<SearchCategory>("All");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const shortcutEnabled = mode !== "mobile";

  React.useEffect(() => {
    if (!shortcutEnabled) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutEnabled]);

  React.useEffect(() => {
    if (!open) return;
    const search = query.trim().toLowerCase();
    if (!search) {
      setResults([]);
      setResultQuery("");
      setLoading(false);
      return;
    }

    const cached = readSearchCache(search);
    if (cached) {
      setResults(cached);
      setResultQuery(search);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ctrl = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(search)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { results?: SearchResult[] };
        const nextResults = data.results ?? [];
        writeSearchCache(search, nextResults);
        setResults(nextResults);
        setResultQuery(search);
      } catch {
        if (!ctrl.signal.aborted) {
          setResults([]);
          setResultQuery(search);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
      ctrl.abort();
    };
  }, [open, query]);

  React.useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 40);
      return;
    }
    setQuery("");
    setResults([]);
    setResultQuery("");
    setActive(0);
    setCategory("All");
  }, [open]);

  const entries = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    const base = search ? (resultQuery === search ? results : []) : POPULAR_RESULTS;
    return base.map(withIcon).filter(
      (entry) => category === "All" || entry.category === category
    );
  }, [category, query, resultQuery, results]);

  React.useEffect(() => {
    setActive(0);
  }, [category, query]);

  React.useEffect(() => {
    if (!open || entries.length === 0) return;
    const timeoutIds = entries.slice(0, 6).map((entry, index) =>
      window.setTimeout(() => router.prefetch(entry.href), index * 70)
    );
    return () => timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }, [entries, open, router]);

  function go(entry: SearchEntry) {
    setOpen(false);
    beginNavigation(entry.href);
    router.push(entry.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, entries.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && entries[active]) {
      event.preventDefault();
      go(entries[active]);
    }
  }

  return (
    <>
      {mode !== "desktop" && (
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 min-w-0 flex-1 justify-start gap-2 px-2 text-muted-foreground sm:w-64 sm:flex-none sm:px-3 lg:hidden",
            className
          )}
          onClick={() => setOpen(true)}
        >
          <Search className="size-4" />
          <span className="min-w-0 flex-1 truncate text-left text-sm">Search...</span>
        </Button>
      )}
      {mode !== "mobile" && (
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className={cn("hidden lg:inline-flex", className)}
          aria-label="Search"
          onClick={() => setOpen(true)}
        >
          <Search className="size-5" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] w-[min(54rem,calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Search Stockli</DialogTitle>
          <div className="border-b border-border p-4 pr-12 sm:p-5 sm:pr-14">
            <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-background px-4 shadow-sm">
              <Search className="size-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search stocks, funds, indexes, commodities..."
                className="h-full border-0 px-0 text-base shadow-none focus-visible:ring-0"
              />
              {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Popular Searches</p>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setCategory(filter)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      category === filter
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain scrollbar-thin">
            {entries.length === 0 && (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                {loading ? "Searching markets..." : "No results found. Try a symbol, fund, sector, or market name."}
              </p>
            )}
            {entries.map((entry, index) => {
              const Icon = entry.icon;
              const isStock = entry.kind === "stock" && Boolean(entry.symbol);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => go(entry)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-4 border-b border-border px-5 py-4 text-left transition-colors last:border-b-0",
                    index === active ? "bg-muted/70" : "hover:bg-muted/50"
                  )}
                >
                  {isStock ? (
                    <StockLogo
                      symbol={entry.symbol}
                      name={entry.company ?? entry.title}
                      size="md"
                      className="shrink-0"
                    />
                  ) : (
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                      <Icon className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-foreground">
                      {isStock ? entry.symbol || entry.title : entry.title}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {isStock ? entry.company || entry.subtitle : entry.subtitle}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    {entry.category}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function popularResult(
  id: string,
  kind: SearchResult["kind"],
  title: string,
  subtitle: string,
  href: string,
  category: SearchResult["category"],
  symbol = ""
): SearchResult {
  return {
    id,
    kind,
    title,
    subtitle,
    href,
    category,
    symbol,
    company: subtitle,
    sector: null,
  };
}

function withIcon(result: SearchResult): SearchEntry {
  return { ...result, icon: iconFor(result) };
}

function iconFor(result: SearchResult): LucideIcon {
  if (result.kind === "mutual-fund") return BadgePercent;
  if (result.kind === "etf") return Layers3;
  if (result.kind === "index") return LineChart;
  if (result.kind === "commodity") return Boxes;
  if (result.kind === "crypto") return Bitcoin;
  if (result.kind === "sector") return Building2;
  if (result.kind === "page") return result.href.includes("world") ? Globe2 : Landmark;
  return TrendingUp;
}

function readSearchCache(query: string) {
  const now = Date.now();
  const memory = searchMemoryCache.get(query);
  if (memory && memory.expiresAt > now) return memory.results;
  if (memory) searchMemoryCache.delete(query);

  try {
    const raw = window.localStorage.getItem(SEARCH_CACHE_PREFIX + query);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSearch;
    if (!parsed || parsed.expiresAt <= now || !Array.isArray(parsed.results)) {
      window.localStorage.removeItem(SEARCH_CACHE_PREFIX + query);
      return null;
    }
    searchMemoryCache.set(query, parsed);
    return parsed.results;
  } catch {
    return null;
  }
}

function writeSearchCache(query: string, results: SearchResult[]) {
  const cached: CachedSearch = {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    results,
  };
  searchMemoryCache.set(query, cached);
  try {
    window.localStorage.setItem(SEARCH_CACHE_PREFIX + query, JSON.stringify(cached));
  } catch {
    // Storage can be full or disabled; memory cache still helps this session.
  }
}
