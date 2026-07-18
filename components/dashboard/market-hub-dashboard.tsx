"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bitcoin,
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
import { LiveSummaryCards } from "@/components/live-summary-cards";
import { WorldMarketHeatMap } from "@/components/market/world-market-heat-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccentPill, ACCENT_GRADIENT, type Accent } from "@/components/ui/accent";
import { usePersistentResource, type CachedRecord } from "@/lib/hooks/use-persistent-resource";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";
import { shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type {
  GlobalMarketData as PublicGlobalMarketData,
  GlobalMarketQuote as PublicGlobalQuote,
} from "@/lib/services/global-markets";
import {
  isPortfolioCacheFresh,
  PORTFOLIO_MUTATION_EVENT,
} from "@/lib/cache/portfolio-mutations";
import {
  formatMarketPrice,
  formatNumber,
  formatPercent,
  formatSigned,
  plColorClass,
} from "@/lib/format";
import type { HoldingWithMetrics, Portfolio, PortfolioSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;

interface DashboardData {
  dashboard: {
    summary: PortfolioSummary;
    portfolios: Array<Pick<Portfolio, "id" | "name">>;
    holdings: HoldingWithMetrics[];
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

type GlobalQuote = PublicGlobalQuote;
type GlobalMarketData = PublicGlobalMarketData;

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

export function MarketHubDashboard({ userId }: { userId: string }) {
  // While PSX is open we poll live (10-min delayed feed); once it closes we
  // freeze on the device-cached snapshot taken during the session and stop
  // hitting the network until the next pre-open (09:15) — see usePublicHub.
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const acceptPortfolioCache = React.useCallback(
    (record: CachedRecord<DashboardData>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record, userId),
    [cacheClosedOnly, userId]
  );

  const portfolio = usePersistentResource<DashboardData>({
    cacheKey: `private:dashboard:${userId}`,
    url: "/api/private/dashboard",
    refreshInterval: REFRESH_MS,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: acceptPortfolioCache,
  });
  const psx = usePublicHub<PublicMarketData>("public:psx-market", "/api/public/market", cacheClosedOnly);
  const us = usePublicHub<GlobalMarketData>("public:global-market:us", "/api/public/global-market/us", cacheClosedOnly);
  const india = usePublicHub<GlobalMarketData>("public:global-market:india", "/api/public/global-market/india", cacheClosedOnly);
  const world = usePublicHub<GlobalMarketData>("public:global-market:world", "/api/public/global-market/world", cacheClosedOnly);
  const commodities = usePublicHub<GlobalMarketData>("public:global-market:commodities", "/api/public/global-market/commodities", cacheClosedOnly);
  const oil = usePublicHub<GlobalMarketData>("public:global-market:oil", "/api/public/global-market/oil", cacheClosedOnly);
  const crypto = usePublicHub<GlobalMarketData>("public:global-market:crypto", "/api/public/global-market/crypto", cacheClosedOnly);

  // Refresh the portfolio band the instant a holding/portfolio is added,
  // removed or edited — even while the market is closed and the rest of the
  // dashboard stays on the frozen snapshot. Keeps the device cache in sync too.
  const refreshPortfolioRef = React.useRef(portfolio.refreshNow);
  refreshPortfolioRef.current = portfolio.refreshNow;
  React.useEffect(() => {
    const onMutation = () => {
      void refreshPortfolioRef.current();
    };
    window.addEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
    return () => window.removeEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
  }, []);

  const data = {
    portfolio: portfolio.data ?? undefined,
    psx: psx.data ?? undefined,
    us: us.data ?? undefined,
    india: india.data ?? undefined,
    world: world.data ?? undefined,
    commodities: commodities.data ?? undefined,
    oil: oil.data ?? undefined,
    crypto: crypto.data ?? undefined,
  };
  const refreshing = [
    portfolio.isRefreshing,
    psx.isRefreshing,
    us.isRefreshing,
    india.isRefreshing,
    world.isRefreshing,
    commodities.isRefreshing,
    oil.isRefreshing,
    crypto.isRefreshing,
  ].some(Boolean);

  const refreshAll = React.useCallback(() => {
    void portfolio.refreshNow();
    void psx.refreshNow();
    void us.refreshNow();
    void india.refreshNow();
    void world.refreshNow();
    void commodities.refreshNow();
    void oil.refreshNow();
    void crypto.refreshNow();
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

      <section>
        <DashboardWorldMapCard
          href="/market/world"
          title="World view"
          eyebrow="Country exchange map"
          data={data.world}
          featured={worldFeatured}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <DashboardMarketCard
          href="/market"
          accent="primary"
          icon={<Landmark className="size-5" />}
          title="PSX market"
          eyebrow="Indices"
          featured={kse100 ? featuredIndexCard(kse100) : null}
          rows={psxRows(data.psx)}
        />
        <DashboardMarketCard
          href="/market/us"
          accent="sky"
          icon={<LineChart className="size-5" />}
          title="USA stocks"
          eyebrow="Famous names"
          featured={usFeatured}
          rows={quoteRows(data.us, ["GOOGL", "NVDA", "META", "TSLA", "AAPL", "MSFT", "AMZN"])}
        />
        <DashboardMarketCard
          href="/market/commodities"
          accent="amber"
          icon={<Gem className="size-5" />}
          title="Commodities"
          eyebrow="Metals and futures"
          featured={goldFeatured}
          rows={quoteRows(data.commodities, ["GC=F", "SI=F", "PL=F", "HG=F", "PA=F", "ZC=F", "ZW=F"])}
        />
        <DashboardMarketCard
          href="/market/oil"
          accent="orange"
          icon={<Droplets className="size-5" />}
          title="Oil market"
          eyebrow="Energy futures"
          featured={brentFeatured}
          rows={quoteRows(data.oil, ["CL=F", "BZ=F", "NG=F", "RB=F", "HO=F"])}
        />
        <DashboardMarketCard
          href="/market/crypto"
          accent="violet"
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

/**
 * Public market hub resource: device-cached, polls live only while PSX is in a
 * trading session, otherwise serves the frozen snapshot from IndexedDB so the
 * dashboard loads instantly and stops re-fetching after the close.
 */
function usePublicHub<T>(
  cacheKey: string,
  url: string,
  cacheClosedOnly: () => boolean
) {
  return usePersistentResource<T>({
    cacheKey,
    url,
    refreshInterval: REFRESH_MS,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: cacheClosedOnly,
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

  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-100/70 bg-gradient-to-br from-emerald-50/75 via-background to-sky-50/75 p-4 shadow-soft ring-1 ring-emerald-100/60 sm:p-6 dark:border-emerald-900/50 dark:from-emerald-950/25 dark:to-sky-950/20">
      <div className="pointer-events-none absolute inset-0 bg-brand-mesh opacity-60" aria-hidden />
      <div className="relative">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <AccentPill accent="primary">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              Portfolio overview
            </AccentPill>
            <h1 className="mt-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              Your portfolio <span className="text-gradient-emerald">command center</span>
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {summary?.holdingsCount ?? 0} positions across your workspaces, with live P/L and market movement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-9 gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 px-3.5 text-sm text-white shadow-sm shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-300 hover:text-white">
              <Link href="/portfolios">
                <Wallet className="size-4" />
                Open portfolios
              </Link>
            </Button>
            <Button type="button" onClick={onRefresh} className="h-9 gap-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-fuchsia-400 hover:text-white hover:shadow-violet-500/35">
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-5">
          <LiveSummaryCards
            holdings={data?.dashboard.holdings ?? []}
            realizedPL={summary?.realizedPL ?? 0}
          />
        </div>
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
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  eyebrow: string;
  featured: FeaturedMarketMove | null;
  rows: DashboardRow[];
  accent: Accent;
}) {
  const hasMotion = rows.length >= 5;
  const visibleRows = rows.length ? rows : [];
  const loopRows = hasMotion ? [...visibleRows, ...visibleRows] : visibleRows;

  return (
    <Card className="h-full min-h-[28rem] overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:min-h-[34rem]">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11 sm:rounded-2xl [&>svg]:size-5", ACCENT_GRADIENT[accent])}>
              {icon}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-medium leading-tight sm:text-xl">{title}</CardTitle>
              <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs sm:font-semibold">
                {eyebrow}
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-8 shrink-0 sm:size-10">
            <Link href={href} aria-label={`Open ${title}`}>
              <ArrowRight className="size-4 sm:size-5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-24 flex-col items-start justify-end gap-2 sm:min-h-20 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          {featured ? (
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs sm:font-semibold">
                {featured.label}
              </p>
              <p className={cn("mt-1 break-words text-base font-normal leading-tight tabular-nums sm:text-xl sm:font-medium", plColorClass(featured.changePct))}>
                {featured.value}
              </p>
              <p className={cn("mt-0.5 break-words text-[10px] font-normal leading-tight tabular-nums sm:text-xs sm:font-medium", plColorClass(featured.changePct))}>
                {featured.change}
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs sm:font-semibold">
                Updating
              </p>
              <p className="mt-1 text-base font-normal tabular-nums text-muted-foreground sm:text-2xl sm:font-medium">
                Loading
              </p>
            </div>
          )}
          <ChangePill value={featured?.changePct ?? null} />
        </div>

        <div className="mt-4 h-[18.5rem] overflow-hidden sm:mt-5 sm:h-[23.25rem]">
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

function DashboardWorldMapCard({
  href,
  title,
  eyebrow,
  data,
  featured,
}: {
  href: string;
  title: string;
  eyebrow: string;
  data: GlobalMarketData | undefined;
  featured: FeaturedMarketMove | null;
}) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", ACCENT_GRADIENT.indigo)}>
              <Globe2 className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl leading-tight">{title}</CardTitle>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {eyebrow}
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-10 shrink-0">
            <Link href={href} aria-label={`Open ${title}`}>
              <ArrowRight className="size-5" />
            </Link>
          </Button>
        </div>

        {featured ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/35 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Strongest board
            </span>
            <span className="text-sm font-semibold text-foreground">{featured.label}</span>
            <span className={cn("text-sm font-semibold tabular-nums", plColorClass(featured.changePct))}>
              {featured.value}
            </span>
            <span className={cn("text-sm font-semibold tabular-nums", plColorClass(featured.changePct))}>
              {featured.change}
            </span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {data ? (
          <WorldMarketHeatMap data={data} compact />
        ) : (
          <div className="flex min-h-[32rem] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading world map...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardRowItem({ row, ariaHidden }: { row: DashboardRow; ariaHidden?: boolean }) {
  const content = (
    <div
      aria-hidden={ariaHidden}
      className="flex min-h-[3.75rem] items-center justify-between gap-2 rounded-xl border border-border bg-muted/35 px-2 py-2 sm:min-h-[4.15rem] sm:gap-3 sm:px-3"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-normal leading-tight sm:text-base sm:font-medium">
          {row.symbol}
        </p>
        <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground sm:text-sm">
          {row.name}
        </p>
      </div>
      <div className="min-w-[4.8rem] shrink-0 text-right sm:min-w-[6.25rem]">
        <p className={cn("truncate text-[10px] font-normal leading-tight tabular-nums sm:text-sm sm:font-medium", plColorClass(row.changePct))}>
          {row.value}
        </p>
        <p className={cn("truncate text-[9px] font-normal leading-tight tabular-nums sm:text-xs sm:font-medium", plColorClass(row.changePct))}>
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
      <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground sm:px-2.5 sm:py-1 sm:text-xs sm:font-medium">
        Updating
      </span>
    );
  }
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-normal tabular-nums sm:px-2.5 sm:py-1 sm:text-xs sm:font-medium",
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
  return getMarketDisplaySymbol(quote.symbol, quote.displaySymbol);
}

function quoteSubtitle(quote: GlobalQuote) {
  return quote.name;
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
      label: getMarketDisplaySymbol(quote.symbol, quote.displaySymbol),
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
