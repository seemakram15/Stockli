"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bitcoin,
  Coins,
  Droplets,
  Gem,
  Globe2,
  Landmark,
  LineChart,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { IndexTickerStrip, type DashboardTickerItem } from "@/components/dashboard/index-ticker-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatMarketPrice,
  formatNumber,
  formatPercent,
  formatPKR,
  formatSigned,
  plColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;

type ApiEnvelope<T> = { data: T };

interface DashboardData {
  dashboard: {
    summary: {
      totalValue: number;
      totalInvested: number;
      totalPL: number;
      totalPLPct: number;
      dayPL: number;
      dayPLPct: number;
      holdingsCount: number;
    };
    portfolios: Array<{ id: string; name: string }>;
    holdings: Array<{ id: string; symbol: string; dayChange: number; dayChangePct: number }>;
    topGainers: Array<{ id: string; symbol: string; dayChange: number; dayChangePct: number; livePrice: number }>;
    topLosers: Array<{ id: string; symbol: string; dayChange: number; dayChangePct: number; livePrice: number }>;
  };
  market: { label: string; status: string };
  updatedAt: string;
}

interface IndexCardData {
  symbol: string;
  name: string;
  current: number;
  change: number;
  changePct: number;
}

interface PublicMarketData {
  cards: IndexCardData[];
  detail: IndexCardData | null;
  analytics: {
    performers: {
      active: Array<{ symbol: string; price: number; change: number; changePct: number; volume: number | null }>;
      advancers: Array<{ symbol: string; price: number; change: number; changePct: number }>;
      decliners: Array<{ symbol: string; price: number; change: number; changePct: number }>;
    };
    sectors: Array<{ sector: string; avgChangePct: number; advancers: number; decliners: number; count: number }>;
  };
  updatedAt: string;
}

interface GlobalQuote {
  symbol: string;
  displaySymbol?: string;
  name: string;
  type: string;
  country?: string;
  currency?: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
}

interface GlobalMarketData {
  title: string;
  description: string;
  quotes: GlobalQuote[];
  summary: {
    advancers: number;
    decliners: number;
    flat: number;
    avgChangePct: number;
    best: GlobalQuote | null;
    worst: GlobalQuote | null;
  };
}

type HubResponseMap = {
  portfolio: DashboardData;
  psx: PublicMarketData;
  us: GlobalMarketData;
  india: GlobalMarketData;
  world: GlobalMarketData;
  commodities: GlobalMarketData;
  oil: GlobalMarketData;
  crypto: GlobalMarketData;
};

interface DashboardRow {
  id: string;
  symbol: string;
  name: string;
  value: string;
  change: string;
  changePct: number | null;
  href?: string;
}

interface FeaturedMarketMove {
  label: string;
  value: string;
  change: string;
  changePct: number | null;
}

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data;
};

export function MarketHubDashboard() {
  const portfolio = useHubSWR<DashboardData>("/api/private/dashboard");
  const psx = useHubSWR<PublicMarketData>("/api/public/market");
  const us = useHubSWR<GlobalMarketData>("/api/public/global-market/us");
  const india = useHubSWR<GlobalMarketData>("/api/public/global-market/india");
  const world = useHubSWR<GlobalMarketData>("/api/public/global-market/world");
  const commodities = useHubSWR<GlobalMarketData>("/api/public/global-market/commodities");
  const oil = useHubSWR<GlobalMarketData>("/api/public/global-market/oil");
  const crypto = useHubSWR<GlobalMarketData>("/api/public/global-market/crypto");

  const data = {
    portfolio: portfolio.data,
    psx: psx.data,
    us: us.data,
    india: india.data,
    world: world.data,
    commodities: commodities.data,
    oil: oil.data,
    crypto: crypto.data,
  };
  const refreshing = [
    portfolio.isValidating,
    psx.isValidating,
    us.isValidating,
    india.isValidating,
    world.isValidating,
    commodities.isValidating,
    oil.isValidating,
    crypto.isValidating,
  ].some(Boolean);

  const refreshAll = React.useCallback(() => {
    void portfolio.mutate();
    void psx.mutate();
    void us.mutate();
    void india.mutate();
    void world.mutate();
    void commodities.mutate();
    void oil.mutate();
    void crypto.mutate();
  }, [commodities, crypto, india, oil, portfolio, psx, us, world]);

  const kse100 = data.psx?.detail ?? data.psx?.cards.find((card) => card.symbol === "KSE100") ?? null;
  const usFeatured = featuredIndex(data.us, ["^GSPC", "^DJI", "^NDX"]);
  const worldFeatured = featuredIndex(data.world, [
    "^GSPC",
    "^FTSE",
    "^GDAXI",
    "^FCHI",
    "^NSEI",
    "^N225",
    "^HSI",
    "000001.SS",
  ]);
  const goldFeatured = featuredQuote(data.commodities, "GC=F");
  const brentFeatured = featuredQuote(data.oil, "BZ=F");
  const btcFeatured = featuredQuote(data.crypto, "BTC");
  const tickerItems = buildTickerItems(data);
  const headlineTicker = kse100
    ? {
        symbol: kse100.symbol,
        current: kse100.current,
        change: kse100.change,
        changePct: kse100.changePct,
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <IndexTickerStrip headline={headlineTicker} items={tickerItems} />

      <PortfolioOverviewBand
        data={data.portfolio}
        refreshing={refreshing}
        onRefresh={refreshAll}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardMarketCard
          href="/market"
          icon={<Landmark className="size-5" />}
          title="PSX market"
          eyebrow="Indices"
          featured={kse100 ? featuredIndexCard(kse100) : null}
          rows={psxRows(data.psx)}
        />
        <DashboardMarketCard
          href="/market/us"
          icon={<LineChart className="size-5" />}
          title="USA stocks"
          eyebrow="Famous names"
          featured={usFeatured}
          rows={quoteRows(data.us, ["GOOGL", "NVDA", "META", "TSLA", "AAPL", "MSFT", "AMZN"])}
        />
        <DashboardMarketCard
          href="/market/world"
          icon={<Globe2 className="size-5" />}
          title="World indices"
          eyebrow="Famous global indices"
          featured={worldFeatured}
          rows={quoteRows(data.world, ["^GSPC", "^FTSE", "^GDAXI", "^FCHI", "^NSEI", "^N225", "^HSI", "000001.SS"])}
        />
        <DashboardMarketCard
          href="/market/commodities"
          icon={<Gem className="size-5" />}
          title="Commodities"
          eyebrow="Metals and futures"
          featured={goldFeatured}
          rows={quoteRows(data.commodities, ["GC=F", "SI=F", "PL=F", "HG=F", "PA=F", "ZC=F", "ZW=F"])}
        />
        <DashboardMarketCard
          href="/market/oil"
          icon={<Droplets className="size-5" />}
          title="Oil market"
          eyebrow="Energy futures"
          featured={brentFeatured}
          rows={quoteRows(data.oil, ["CL=F", "BZ=F", "NG=F", "RB=F", "HO=F"])}
        />
        <DashboardMarketCard
          href="/market/crypto"
          icon={<Bitcoin className="size-5" />}
          title="Crypto market"
          eyebrow="BTC, ETH, SOL, BNB, SUI"
          featured={btcFeatured}
          rows={quoteRows(data.crypto, ["BTC", "ETH", "SOL", "BNB", "SUI", "XRP", "DOGE"])}
        />
      </section>
    </div>
  );
}

function useHubSWR<T>(url: string) {
  return useSWR<T>(url, fetcher<T>, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
    shouldRetryOnError: false,
  });
}

function PortfolioOverviewBand({
  data,
  refreshing,
  onRefresh,
}: {
  data?: DashboardData;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const summary = data?.dashboard.summary;
  const stats = [
    {
      label: "Total value",
      value: formatPKR(summary?.totalValue ?? null),
      tone: null,
      icon: <Wallet className="size-4" />,
    },
    {
      label: "Day P/L",
      value: formatPKR(summary?.dayPL ?? null, { sign: true }),
      tone: summary?.dayPL ?? null,
      icon: <ArrowUp className="size-4" />,
    },
    {
      label: "Total P/L",
      value: formatPKR(summary?.totalPL ?? null, { sign: true }),
      tone: summary?.totalPL ?? null,
      icon: <LineChart className="size-4" />,
    },
    {
      label: "Invested",
      value: formatPKR(summary?.totalInvested ?? null),
      tone: null,
      icon: <Coins className="size-4" />,
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Portfolio overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Your portfolio command center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary?.holdingsCount ?? 0} positions across your workspaces, with live P/L and market movement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/portfolios">Open portfolios</Link>
          </Button>
          <Button type="button" onClick={onRefresh} variant="outline">
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-h-28 flex-col justify-between rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="text-sm font-medium">{stat.label}</span>
              {stat.icon}
            </div>
            <p className={cn("mt-4 truncate text-xl font-bold tabular-nums sm:text-2xl", plColorClass(stat.tone))}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardMarketCard({
  href,
  icon,
  title,
  eyebrow,
  featured,
  rows,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  eyebrow: string;
  featured: FeaturedMarketMove | null;
  rows: DashboardRow[];
}) {
  const hasMotion = rows.length >= 5;
  const visibleRows = rows.length ? rows : [];
  const loopRows = hasMotion ? [...visibleRows, ...visibleRows] : visibleRows;

  return (
    <Card className="h-full min-h-[34rem] overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {icon}
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">{title}</CardTitle>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href={href} aria-label={`Open ${title}`}>
              <ArrowRight className="size-5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-20 items-end justify-between gap-3">
          {featured ? (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {featured.label}
              </p>
              <p className={cn("mt-1 truncate text-2xl font-semibold tabular-nums sm:text-[1.7rem]", plColorClass(featured.changePct))}>
                {featured.value}
              </p>
              <p className={cn("mt-0.5 truncate text-sm font-medium tabular-nums", plColorClass(featured.changePct))}>
                {featured.change} · {formatPercent(featured.changePct)}
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Updating
              </p>
              <p className="mt-1 truncate text-3xl font-bold tabular-nums text-muted-foreground">
                Loading
              </p>
            </div>
          )}
          <ChangePill value={featured?.changePct ?? null} />
        </div>

        <div className="mt-5 h-[23.25rem] overflow-hidden">
          {loopRows.length ? (
            <div
              className={cn(
                "space-y-2",
                hasMotion && "animate-[stockli-card-roll_22s_linear_infinite] hover:[animation-play-state:paused]"
              )}
            >
              {loopRows.map((row, index) => (
                <DashboardRowItem
                  key={`${row.id}-${index}`}
                  row={row}
                  ariaHidden={hasMotion && index >= visibleRows.length}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading live data...
            </div>
          )}
        </div>
      </CardContent>
      <style>{`
        @keyframes stockli-card-roll {
          from { transform: translateY(0); }
          to { transform: translateY(-50%); }
        }
      `}</style>
    </Card>
  );
}

function DashboardRowItem({ row, ariaHidden }: { row: DashboardRow; ariaHidden?: boolean }) {
  const content = (
    <div
      aria-hidden={ariaHidden}
      className="flex min-h-[4.15rem] items-center justify-between gap-3 rounded-xl border border-border bg-muted/35 px-3 py-2"
    >
      <div className="min-w-0">
        <p className="truncate text-base font-semibold">{row.symbol}</p>
        <p className="truncate text-sm text-muted-foreground">{row.name}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold tabular-nums", plColorClass(row.changePct))}>
          {row.value}
        </p>
        <p className={cn("text-xs font-semibold tabular-nums", plColorClass(row.changePct))}>
          {row.change} · {formatPercent(row.changePct)}
        </p>
      </div>
    </div>
  );

  return row.href ? (
    <Link href={row.href} className="block transition hover:-translate-y-0.5 hover:shadow-sm">
      {content}
    </Link>
  ) : (
    content
  );
}

function ChangePill({ value }: { value: number | null }) {
  if (value == null || Number.isNaN(value)) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        Updating
      </span>
    );
  }
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
        value < 0 ? "bg-loss/10 text-loss" : value > 0 ? "bg-gain/10 text-gain" : "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-3" />
      {formatPercent(value)}
    </span>
  );
}

function featuredIndexCard(card: IndexCardData): FeaturedMarketMove {
  return {
    label: card.symbol,
    value: formatNumber(card.current, 2),
    change: formatSigned(card.change, 2),
    changePct: card.changePct,
  };
}

function featuredIndex(
  data: GlobalMarketData | undefined,
  preferredSymbols: string[]
): FeaturedMarketMove | null {
  if (!data?.quotes.length) return null;
  const preferred = pickQuotes(data, preferredSymbols).filter((quote) =>
    quote.type.toLowerCase().includes("index")
  );
  const candidates = preferred.length
    ? preferred
    : data.quotes.filter((quote) => quote.type.toLowerCase().includes("index"));
  const quote = candidates
    .filter((item) => item.price != null)
    .sort((a, b) => (b.changePct ?? Number.NEGATIVE_INFINITY) - (a.changePct ?? Number.NEGATIVE_INFINITY))[0];

  return quote ? featuredQuoteMove(quote, "name") : null;
}

function featuredQuote(data: GlobalMarketData | undefined, symbol: string): FeaturedMarketMove | null {
  const quote = data?.quotes.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
  return quote ? featuredQuoteMove(quote, symbol.toUpperCase() === "BTC" ? "symbol" : "name") : null;
}

function featuredQuoteMove(
  quote: GlobalQuote,
  labelMode: "name" | "symbol" = "name"
): FeaturedMarketMove {
  return {
    label: labelMode === "symbol" ? quoteTitle(quote) : quote.name,
    value: formatMarketPrice(quote.price, quote.currency),
    change: formatMarketChange(quote.change, quote.currency, quote.type),
    changePct: quote.changePct,
  };
}

function formatMarketChange(
  value: number | null | undefined,
  currency?: string | null,
  type?: string | null
) {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const decimals = abs >= 100 ? 2 : abs >= 10 ? 2 : abs >= 1 ? 4 : 4;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const isIndex = type?.toLowerCase().includes("index");
  return currency && !isIndex ? `${sign}${currency} ${formatted}` : `${sign}${formatted}`;
}

function psxRows(data: PublicMarketData | undefined): DashboardRow[] {
  return (data?.cards ?? []).slice(0, 12).map((card) => ({
    id: card.symbol,
    symbol: card.symbol,
    name: card.name,
    value: formatNumber(card.current, 2),
    change: formatSigned(card.change, 2),
    changePct: card.changePct,
    href: "/market",
  }));
}

function quoteRows(data: GlobalMarketData | undefined, symbols: string[]): DashboardRow[] {
  const quotes = pickQuotes(data, symbols);
  return quotes.map((quote) => ({
    id: quote.symbol,
    symbol: quoteTitle(quote),
    name: quoteSubtitle(quote),
    value: formatMarketPrice(quote.price, quote.currency),
    change: formatSigned(quote.change, Math.abs(quote.change ?? 0) >= 10 ? 2 : 4),
    changePct: quote.changePct,
    href: marketHrefForQuote(quote),
  }));
}

function quoteTitle(quote: GlobalQuote) {
  if (quote.symbol.includes("=")) return quote.name;
  return quote.displaySymbol ?? quote.symbol;
}

function quoteSubtitle(quote: GlobalQuote) {
  if (quote.symbol.includes("=")) return cleanFuturesSymbol(quote.symbol);
  return quote.name;
}

function cleanFuturesSymbol(symbol: string) {
  return symbol.replace(/=F$/i, "").replace("=", "");
}

function marketHrefForQuote(quote: GlobalQuote) {
  const type = quote.type.toLowerCase();
  if (type.includes("crypto")) return "/market/crypto";
  if (["CL=F", "BZ=F", "NG=F", "RB=F", "HO=F"].includes(quote.symbol.toUpperCase())) return "/market/oil";
  if (quote.symbol.includes("=")) return "/market/commodities";
  if (quote.country === "United States") return "/market/us";
  if (quote.country === "India") return "/market/india";
  return "/market/world";
}

function buildTickerItems(data: Partial<HubResponseMap>): DashboardTickerItem[] {
  return [
    ...(data.psx?.cards ?? [])
      .filter((card) => card.symbol !== "KSE100")
      .map((card) => ({
        symbol: card.symbol,
        current: card.current,
        change: card.change,
        changePct: card.changePct,
      })),
    ...quotesToTicker(pickQuotes(data.oil, ["CL=F", "BZ=F", "NG=F"])),
    ...quotesToTicker(pickQuotes(data.commodities, ["GC=F", "SI=F", "PL=F"])),
    ...quotesToTicker(pickQuotes(data.crypto, ["BTC", "ETH", "SOL", "BNB", "SUI"])),
    ...quotesToTicker(pickQuotes(data.us, ["GOOGL", "NVDA", "META", "TSLA", "AAPL"])),
  ];
}

function quotesToTicker(quotes: GlobalQuote[]): DashboardTickerItem[] {
  return quotes
    .filter((quote) => quote.price != null && quote.change != null && quote.changePct != null)
    .map((quote) => ({
      symbol: quote.symbol,
      label: quote.displaySymbol ?? quote.symbol,
      current: quote.price ?? 0,
      change: quote.change ?? 0,
      changePct: quote.changePct ?? 0,
    }));
}

function pickQuotes(data: GlobalMarketData | undefined, symbols: string[]) {
  if (!data?.quotes.length) return [];
  const map = new Map(data.quotes.map((quote) => [quote.symbol.toUpperCase(), quote]));
  const picked = symbols
    .map((symbol) => map.get(symbol.toUpperCase()))
    .filter(Boolean) as GlobalQuote[];
  return picked.length ? picked : data.quotes.slice(0, 12);
}
