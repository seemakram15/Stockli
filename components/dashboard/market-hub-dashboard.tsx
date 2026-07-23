"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bitcoin,
  Droplets,
  Fuel,
  Gem,
  Globe2,
  Landmark,
  LineChart,
  Loader2,
  Maximize2,
  Sparkles,
  Wallet,
} from "lucide-react";
import { IndexTickerStrip, type DashboardTickerItem } from "@/components/dashboard/index-ticker-strip";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { WorldMarketHeatMap } from "@/components/market/world-market-heat-map";
import { useViewportEnabled } from "@/components/loading/viewport-lazy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccentPill, ACCENT_GRADIENT, IconChip, type Accent } from "@/components/ui/accent";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isClosedMarketSnapshotCurrent,
  isPortfolioCacheFresh,
  PORTFOLIO_MUTATION_EVENT,
} from "@/lib/cache/portfolio-mutations";
import {
  formatCompact,
  formatMarketPrice,
  formatNumber,
  formatPercent,
  formatPKR,
  formatSigned,
  plColorClass,
} from "@/lib/format";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { usePersistentResource, type CachedRecord } from "@/lib/hooks/use-persistent-resource";
import type { RefreshJob } from "@/lib/hooks/use-refresh-runner";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";
import { marketStatus, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { getSeedTicker } from "@/lib/psx/symbols";
import { computeSummary } from "@/lib/services/metrics";
import type {
  GlobalMarketData as PublicGlobalMarketData,
  GlobalMarketQuote as PublicGlobalQuote,
} from "@/lib/services/global-markets";
import type { HoldingWithMetrics, Portfolio, PortfolioSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PkSpotPrice {
  pricePerTola: number | null;
  changePerTola: number | null;
}

interface PkCommoditiesData {
  gold24: PkSpotPrice | null;
  silver: PkSpotPrice | null;
  usdPkr: number | null;
  updatedAt: string;
  source: string;
}

interface PakistanFuelData {
  effectiveDate: string;
  current: Array<{
    label: string;
    oldPrice: number | null;
    newPrice: number | null;
    signedChange: number | null;
  }>;
  updatedAt: string;
}

const REFRESH_MS = 60_000;
const PK_RATES_REFRESH_MS = 90_000;
const FUEL_REFRESH_MS = 6 * 60 * 60 * 1000;

interface DashboardData {
  dashboard: {
    summary: PortfolioSummary;
    portfolios: Array<Pick<Portfolio, "id" | "name">>;
    holdings: HoldingWithMetrics[];
    topGainers: Array<{
      id: string;
      symbol: string;
      dayChange: number;
      dayChangePct: number;
      livePrice: number;
    }>;
    topLosers: Array<{
      id: string;
      symbol: string;
      dayChange: number;
      dayChangePct: number;
      livePrice: number;
    }>;
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
  week52High?: number;
  week52Low?: number;
  high?: number | null;
  low?: number | null;
  prevClose?: number | null;
  volume?: number | null;
}

interface PsxIndexSnapshot {
  symbol: string;
  name: string;
  current: number;
  change: number;
  changePct: number;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
}

interface PublicMarketData {
  cards: IndexCardData[];
  detail: IndexCardData | null;
  analytics: {
    performers: {
      active: Array<{
        symbol: string;
        price: number;
        change: number;
        changePct: number;
        volume: number | null;
      }>;
      advancers: Array<{ symbol: string; price: number; change: number; changePct: number }>;
      decliners: Array<{ symbol: string; price: number; change: number; changePct: number }>;
    };
    sectors: Array<{
      sector: string;
      avgChangePct: number;
      advancers: number;
      decliners: number;
      count: number;
      stocks?: Array<{
        symbol: string;
        name: string | null;
        price: number;
        change: number;
        changePct: number;
      }>;
    }>;
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
  const cacheClosedOnly = React.useCallback(() => !shouldRefreshPsxData(), []);
  const acceptPortfolioCache = React.useCallback(
    (record: CachedRecord<DashboardData>) =>
      cacheClosedOnly() && isPortfolioCacheFresh(record, userId),
    [cacheClosedOnly, userId]
  );

  // Critical above-the-fold feeds — load immediately.
  const portfolio = usePersistentResource<DashboardData>({
    cacheKey: `private:dashboard:${userId}`,
    url: "/api/private/dashboard",
    refreshInterval: REFRESH_MS,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: acceptPortfolioCache,
  });
  const psx = usePublicHub<PublicMarketData>(
    "public:psx-market:v3",
    "/api/public/market",
    cacheClosedOnly
  );

  // Below-the-fold — fetch only once the section is near the viewport.
  // Tight margins + sequential enable so tall screens don't stampede all APIs at once.
  const ratesGate = useViewportEnabled({ rootMargin: "120px 0px" });
  const worldGate = useViewportEnabled({ rootMargin: "100px 0px" });
  const boardsGate = useViewportEnabled({ rootMargin: "80px 0px" });
  const ratesEnabled = ratesGate.visible;
  const worldEnabled = ratesEnabled && worldGate.visible;

  const pkRates = usePersistentResource<PkCommoditiesData>({
    cacheKey: "public:pk-commodities-v12",
    url: "/api/public/pakistan-commodities",
    refreshInterval: PK_RATES_REFRESH_MS,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: (record) => cacheClosedOnly() && isClosedMarketSnapshotCurrent(record),
    enabled: ratesEnabled,
  });
  const fuel = usePersistentResource<PakistanFuelData>({
    cacheKey: "public:pk-fuel-prices-v1",
    url: "/api/public/pakistan-fuel-prices",
    refreshInterval: FUEL_REFRESH_MS,
    acceptCacheWhen: () => true,
    enabled: ratesEnabled,
  });
  const oil = usePublicHub<GlobalMarketData>(
    "public:global-market:oil",
    "/api/public/global-market/oil",
    cacheClosedOnly,
    ratesEnabled,
    { pauseOnPsxHours: false }
  );
  const world = usePublicHub<GlobalMarketData>(
    "public:global-market:world",
    "/api/public/global-market/world",
    cacheClosedOnly,
    worldEnabled,
    { pauseOnPsxHours: false }
  );
  const us = usePublicHub<GlobalMarketData>(
    "public:global-market:us",
    "/api/public/global-market/us",
    cacheClosedOnly,
    worldEnabled,
    { pauseOnPsxHours: false }
  );

  // Hold market cards until the world feed has painted so we don't compete with ATF requests.
  const boardsEnabled =
    worldEnabled && boardsGate.visible && (world.data != null || Boolean(world.error));

  const india = usePublicHub<GlobalMarketData>(
    "public:global-market:india",
    "/api/public/global-market/india",
    cacheClosedOnly,
    boardsEnabled,
    { pauseOnPsxHours: false }
  );
  const commodities = usePublicHub<GlobalMarketData>(
    "public:global-market:commodities",
    "/api/public/global-market/commodities",
    cacheClosedOnly,
    boardsEnabled,
    { pauseOnPsxHours: false }
  );
  const crypto = usePublicHub<GlobalMarketData>(
    "public:global-market:crypto",
    "/api/public/global-market/crypto",
    cacheClosedOnly,
    boardsEnabled,
    { pauseOnPsxHours: false }
  );

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
    pkRates: pkRates.data ?? undefined,
    fuel: fuel.data ?? undefined,
  };

  const refreshJobs = React.useMemo<RefreshJob[]>(
    () => [
      {
        id: "psx",
        label: "Refreshing PSX prices & indexes",
        detail: "Force-clears mid-session caches, then pulls the delayed feed",
        critical: true,
        run: async () => {
          const next = await psx.refreshNow({ url: "/api/public/market?fresh=1" });
          const kse = next.detail ?? next.cards.find((card) => card.symbol === "KSE100");
          return kse
            ? `KSE100 ${formatSigned(kse.change, 2)} (${formatPercent(kse.changePct)})`
            : `${next.cards.length} indexes updated`;
        },
      },
      {
        id: "portfolio",
        label: "Updating your portfolio",
        detail: "Live holdings value and day P/L",
        run: async () => {
          const next = await portfolio.refreshNow();
          return `${next.dashboard.summary.holdingsCount} positions · ${formatPKR(next.dashboard.summary.totalValue)}`;
        },
      },
      {
        id: "pakistan",
        label: "Pakistan gold, silver & USD",
        detail: "Sarafa rates in PKR per tola",
        run: async () => {
          const next = await pkRates.refreshNow({
            url: "/api/public/pakistan-commodities?fresh=1",
          });
          const gold = next.gold24?.pricePerTola;
          return gold != null ? `Gold 24K Rs ${formatNumber(gold, 0)}/tola` : "Pakistan rates updated";
        },
      },
      {
        id: "fuel",
        label: "Pakistan fuel prices",
        detail: "Petrol, diesel and OGRA revision",
        run: async () => {
          const next = await fuel.refreshNow({
            url: "/api/public/pakistan-fuel-prices?fresh=1",
          });
          const petrol = next.current.find((item) => /petrol/i.test(item.label));
          return petrol?.newPrice != null
            ? `Petrol Rs ${petrol.newPrice.toFixed(2)}`
            : "Fuel board updated";
        },
      },
      {
        id: "world",
        label: "World exchanges & heat map",
        detail: "Country boards for the world view",
        run: async () => {
          await world.refreshNow({ url: "/api/public/global-market/world?fresh=1" });
          return "World map refreshed";
        },
      },
      {
        id: "global",
        label: "Global markets, oil & crypto",
        detail: "US, India, commodities, oil and crypto boards",
        run: async () => {
          await Promise.all([
            us.refreshNow({ url: "/api/public/global-market/us?fresh=1" }),
            india.refreshNow({ url: "/api/public/global-market/india?fresh=1" }),
            commodities.refreshNow({ url: "/api/public/global-market/commodities?fresh=1" }),
            oil.refreshNow({ url: "/api/public/global-market/oil?fresh=1" }),
            crypto.refreshNow({ url: "/api/public/global-market/crypto?fresh=1" }),
          ]);
          return "Global boards updated";
        },
      },
    ],
    [commodities, crypto, fuel, india, oil, pkRates, portfolio, psx, us, world]
  );

  const kse100 = data.psx?.detail ?? data.psx?.cards.find((card) => card.symbol === "KSE100") ?? null;
  const ffcFeatured = featuredPsxBlueChip(data.psx, "FFC");
  const usFeatured = featuredIndex(data.us, ["^GSPC", "^DJI", "^NDX"]);
  const indiaFeatured = featuredIndex(data.india, ["^NSEI", "^BSESN"]);
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
  const session = marketStatus();
  const lastUpdated = newestTimestamp([
    data.psx?.updatedAt,
    data.portfolio?.updatedAt,
    data.pkRates?.updatedAt,
  ]);

  return (
    <div className="mx-auto max-w-[90rem] space-y-5 pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-emerald-200/35 bg-gradient-to-br from-emerald-50/40 via-background to-sky-50/35 p-4 dark:border-emerald-800/25 dark:from-emerald-950/15 dark:via-background dark:to-sky-950/10 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-brand-mesh opacity-25" aria-hidden />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AccentPill accent="primary">Market hub</AccentPill>
              <SessionBadge label={session.label} status={session.status} />
              {lastUpdated ? (
                <span className="text-xs text-muted-foreground">
                  Updated {formatClock(lastUpdated)}
                </span>
              ) : null}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Everything that moves{" "}
                <span className="text-gradient-emerald">today</span>
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                PSX, your portfolios, world exchanges, oil, Pakistan gold & silver, fuel and foreign
                flows — one accurate command center.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="h-9 gap-1.5">
              <Link href="/portfolios">
                <Wallet className="size-4" />
                Portfolios
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-9 gap-1.5">
              <Link href="/market">
                <Landmark className="size-4" />
                PSX market
              </Link>
            </Button>
            <MarketRefreshButton
              color="violet"
              label="Refresh hub"
              title="Refreshing market hub"
              description="Force-fresh every board on this dashboard so numbers stay accurate."
              jobs={refreshJobs}
              autoStart={false}
              startLabel="Start refresh"
            />
          </div>
        </div>
      </header>

      <IndexTickerStrip headline={headlineTicker} items={tickerItems} />

      <section className="grid gap-4 xl:grid-cols-12">
        <KseHeroCard
          cards={data.psx?.cards}
          detail={data.psx?.detail ?? null}
          marketLabel={data.psx ? "PSX delayed feed" : "Loading"}
          className="xl:col-span-5"
        />
        <PortfolioHeroCard data={data.portfolio} className="xl:col-span-7" />
      </section>

      <div ref={ratesGate.ref} className="min-h-[12rem]">
        {ratesEnabled ? (
          <PakistanDailyStrip pkRates={data.pkRates} fuel={data.fuel} oil={data.oil} />
        ) : (
          <HubSectionSkeleton label="Today's key rates" rows={4} />
        )}
      </div>

      <div ref={worldGate.ref} className="min-h-[28rem]">
        {worldEnabled ? (
          <section className="grid items-stretch gap-4 xl:grid-cols-12">
            <div className="min-h-[28rem] xl:col-span-8 xl:min-h-0">
              <DashboardWorldMapCard
                href="/market/world"
                title="World view"
                eyebrow="Country exchange map"
                data={data.world}
                featured={worldFeatured}
              />
            </div>
            <div className="xl:col-span-4">
              <MarketPulseCard us={data.us} world={data.world} />
            </div>
          </section>
        ) : (
          <HubMapSkeleton />
        )}
      </div>

      <div ref={boardsGate.ref} className="min-h-[26rem]">
        {boardsEnabled ? (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            <DashboardMarketCard
              href="/market"
              accent="primary"
              icon={<Landmark className="size-5" />}
              title="PSX market"
              eyebrow="Famous & blue chips"
              featured={ffcFeatured}
              rows={psxBlueChipRows(data.psx)}
            />
            <DashboardMarketCard
              href="/market/us"
              accent="sky"
              icon={<LineChart className="size-5" />}
              title="USA stocks"
              eyebrow="Indexes & megacaps"
              featured={usFeatured}
              rows={quoteRows(data.us, ["GOOGL", "NVDA", "META", "TSLA", "AAPL", "MSFT", "AMZN"])}
            />
            <DashboardMarketCard
              href="/market/india"
              accent="indigo"
              icon={<Globe2 className="size-5" />}
              title="India market"
              eyebrow="Nifty & Sensex names"
              featured={indiaFeatured}
              rows={quoteRows(data.india, ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "SBIN.NS"])}
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
              href="/market/commodities"
              accent="amber"
              icon={<Gem className="size-5" />}
              title="Commodities"
              eyebrow="Metals & futures"
              featured={goldFeatured}
              rows={quoteRows(data.commodities, ["GC=F", "SI=F", "PL=F", "HG=F", "PA=F", "ZC=F", "ZW=F"])}
            />
            <DashboardMarketCard
              href="/market/crypto"
              accent="violet"
              icon={<Bitcoin className="size-5" />}
              title="Crypto market"
              eyebrow="BTC, ETH, SOL, BNB"
              featured={btcFeatured}
              rows={quoteRows(data.crypto, ["BTC", "ETH", "SOL", "BNB", "SUI", "XRP", "DOGE"])}
            />
          </section>
        ) : (
          <HubBoardsSkeleton />
        )}
      </div>
    </div>
  );
}

function HubSectionSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border/70 bg-background p-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="mt-2 h-6 w-24" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function HubMapSkeleton() {
  return (
    <section className="grid items-stretch gap-4 xl:grid-cols-12">
      <div className="min-h-[28rem] overflow-hidden rounded-xl border border-border/70 bg-card xl:col-span-8 sm:min-h-[34rem]">
        <div className="space-y-3 p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-[22rem] w-full rounded-none" />
      </div>
      <div className="min-h-[28rem] overflow-hidden rounded-xl border border-border/70 bg-card p-4 xl:col-span-4 sm:min-h-[34rem]">
        <Skeleton className="h-5 w-32" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

function HubBoardsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="min-h-[26rem] overflow-hidden rounded-xl border border-border/70 bg-card p-4 sm:min-h-[30rem]">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-3 h-16 w-full rounded-2xl" />
          <div className="mt-4 space-y-2">
            {Array.from({ length: 5 }).map((__, row) => (
              <Skeleton key={row} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function usePublicHub<T>(
  cacheKey: string,
  url: string,
  cacheClosedOnly: () => boolean,
  enabled = true,
  options?: { pauseOnPsxHours?: boolean }
) {
  const pauseOnPsxHours = options?.pauseOnPsxHours !== false;
  return usePersistentResource<T>({
    cacheKey,
    url,
    refreshInterval: REFRESH_MS,
    // PSX-tied feeds freeze after settlement. Global boards keep polling —
    // they do not share the Pakistan exchange clock.
    pauseWhen: pauseOnPsxHours ? cacheClosedOnly : undefined,
    acceptCacheWhen: pauseOnPsxHours
      ? (record) => cacheClosedOnly() && isClosedMarketSnapshotCurrent(record)
      : () => true,
    enabled,
  });
}

function SessionBadge({ label, status }: { label: string; status: string }) {
  const live = status === "open" || status === "pre-open" || status === "settling";
  return (
    <span
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        live
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/60 text-muted-foreground"
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50")}
      />
      <span suppressHydrationWarning>PSX {label}</span>
    </span>
  );
}

function HubSectionHeading({
  accent,
  icon,
  eyebrow,
  title,
  description,
  compact = false,
}: {
  accent: Accent;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  const accentWord =
    title.includes(" ")
      ? {
          lead: title.slice(0, title.lastIndexOf(" ")),
          tail: title.slice(title.lastIndexOf(" ") + 1),
        }
      : { lead: title, tail: "" };

  const titleTone: Record<Accent, string> = {
    primary: "text-emerald-600 dark:text-emerald-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    sky: "text-sky-600 dark:text-sky-400",
    violet: "text-violet-600 dark:text-violet-400",
    amber: "text-amber-600 dark:text-amber-400",
    rose: "text-rose-600 dark:text-rose-400",
    teal: "text-teal-600 dark:text-teal-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
    orange: "text-orange-600 dark:text-orange-400",
    slate: "text-slate-600 dark:text-slate-300",
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <IconChip
          accent={accent}
          size="sm"
          className={cn("rounded-xl", compact ? "size-7" : "size-8")}
        >
          {icon}
        </IconChip>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h2
            className={cn(
              "mt-0.5 font-semibold tracking-tight",
              compact ? "text-sm sm:text-base" : "text-base sm:text-lg"
            )}
          >
            <span className="text-foreground">{accentWord.lead}</span>
            {accentWord.tail ? (
              <>
                {" "}
                <span className={cn("font-bold", titleTone[accent])}>{accentWord.tail}</span>
              </>
            ) : null}
          </h2>
        </div>
      </div>
      {description ? (
        <p
          className={cn(
            "mt-1.5 max-w-xl text-sm text-muted-foreground",
            compact ? "sm:pl-9" : "sm:pl-[2.625rem]"
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

function prettyPortfolioName(name: string) {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return name;
  const mostlyUpper =
    cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned) && cleaned.length > 3;
  if (!mostlyUpper) return cleaned;
  return cleaned
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length <= 3 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function portfolioInitials(name: string) {
  const words = prettyPortfolioName(name).split(" ").filter(Boolean);
  if (words.length === 0) return "P";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

const PSX_INDEX_THEMES = {
  KSE100: {
    label: "KSE 100",
    short: "Benchmark",
    accent: "emerald",
  },
  KMI30: {
    label: "KMI 30",
    short: "Shariah",
    accent: "sky",
  },
  KSE30: {
    label: "KSE 30",
    short: "Blue chips",
    accent: "violet",
  },
} as const;

type PsxIndexSymbol = keyof typeof PSX_INDEX_THEMES;

function KseHeroCard({
  cards,
  detail,
  marketLabel,
  className,
}: {
  cards?: IndexCardData[];
  detail: IndexCardData | null;
  marketLabel: string;
  className?: string;
}) {
  const indexes = React.useMemo(() => {
    return (["KSE100", "KMI30", "KSE30"] as const).map((symbol) => {
      const fromCards = cards?.find((card) => card.symbol === symbol) ?? null;
      if (symbol === "KSE100" && detail) {
        return {
          symbol,
          name: detail.name || fromCards?.name || "KSE 100 Index",
          current: detail.current,
          change: detail.change,
          changePct: detail.changePct,
          high: detail.high ?? null,
          low: detail.low ?? null,
          prevClose: detail.prevClose ?? null,
          volume: detail.volume ?? null,
        } satisfies IndexCardData;
      }
      return fromCards;
    });
  }, [cards, detail]);

  const [kse100, kmi30, kse30] = indexes;
  const ready = Boolean(kse100 || kmi30 || kse30);
  const [selected, setSelected] = React.useState<PsxIndexSymbol>("KSE100");
  const [loadedBySymbol, setLoadedBySymbol] = React.useState<
    Partial<Record<PsxIndexSymbol, PsxIndexSnapshot>>
  >({});

  const seedFor = React.useCallback(
    (symbol: PsxIndexSymbol) =>
      symbol === "KSE100" ? kse100 : symbol === "KMI30" ? kmi30 : kse30,
    [kse100, kmi30, kse30]
  );

  React.useEffect(() => {
    if (seedFor(selected)) return;
    if (kse100) setSelected("KSE100");
    else if (kmi30) setSelected("KMI30");
    else if (kse30) setSelected("KSE30");
  }, [kse100, kmi30, kse30, seedFor, selected]);

  React.useEffect(() => {
    if (!ready) return;

    const symbols = (["KSE100", "KMI30", "KSE30"] as const).filter((symbol) => seedFor(symbol));
    let cancelled = false;

    void (async () => {
      await Promise.all(
        symbols.map(async (symbol) => {
          const seed = seedFor(symbol);
          if (!seed) return;

          const hasSessionStats =
            seed.high != null || seed.low != null || seed.prevClose != null || seed.volume != null;

          if (hasSessionStats) {
            if (cancelled) return;
            setLoadedBySymbol((prev) => {
              if (prev[symbol]) return prev;
              return {
                ...prev,
                [symbol]: {
                  symbol,
                  name: seed.name,
                  current: seed.current,
                  change: seed.change,
                  changePct: seed.changePct,
                  high: seed.high ?? null,
                  low: seed.low ?? null,
                  prevClose: seed.prevClose ?? null,
                  volume: seed.volume ?? null,
                },
              };
            });
            return;
          }

          try {
            const res = await fetch(`/api/index/${symbol}`, { cache: "no-store" });
            if (!res.ok) throw new Error(`index ${symbol} failed`);
            const data = (await res.json()) as {
              current?: number;
              change?: number;
              changePct?: number;
              high?: number | null;
              low?: number | null;
              prevClose?: number | null;
              volume?: number | null;
              name?: string;
            };
            if (cancelled || data.current == null) {
              setLoadedBySymbol((prev) => {
                if (prev[symbol]) return prev;
                return {
                  ...prev,
                  [symbol]: {
                    symbol,
                    name: seed.name,
                    current: seed.current,
                    change: seed.change,
                    changePct: seed.changePct,
                    high: null,
                    low: null,
                    prevClose: null,
                    volume: null,
                  },
                };
              });
              return;
            }
            setLoadedBySymbol((prev) => ({
              ...prev,
              [symbol]: {
                symbol,
                name: data.name || seed.name,
                current: data.current ?? seed.current,
                change: data.change ?? seed.change,
                changePct: data.changePct ?? seed.changePct,
                high: data.high ?? null,
                low: data.low ?? null,
                prevClose: data.prevClose ?? null,
                volume: data.volume ?? null,
              },
            }));
          } catch {
            if (cancelled) return;
            setLoadedBySymbol((prev) => {
              if (prev[symbol]) return prev;
              return {
                ...prev,
                [symbol]: {
                  symbol,
                  name: seed.name,
                  current: seed.current,
                  change: seed.change,
                  changePct: seed.changePct,
                  high: null,
                  low: null,
                  prevClose: null,
                  volume: null,
                },
              };
            });
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, seedFor]);

  const selectedSeed = seedFor(selected);
  const displayCard = loadedBySymbol[selected] ?? null;
  const isSelectedLoading = Boolean(selectedSeed) && !displayCard;
  const theme = PSX_INDEX_THEMES[selected];

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden border border-emerald-200/35 bg-gradient-to-br from-emerald-50/40 via-card to-sky-50/30 dark:border-emerald-800/25 dark:from-emerald-950/15 dark:via-card dark:to-sky-950/10",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-10 top-0 h-36 w-36 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden />

      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <IconChip accent="primary" variant="gradient">
              <Landmark />
            </IconChip>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Pakistan Stock Exchange
              </p>
              <CardTitle className="mt-1 text-xl">Key indexes</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{marketLabel}</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-9 shrink-0">
            <Link href="/market" aria-label="Open PSX market">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col gap-5">
        {ready ? (
          <>
            <div
              role="tablist"
              aria-label="PSX indexes"
              className="grid grid-cols-3 gap-1 rounded-2xl border border-border/70 bg-background/80 p-1 shadow-xs"
            >
              {(["KSE100", "KMI30", "KSE30"] as const).map((symbol) => {
                const card = seedFor(symbol);
                const loaded = loadedBySymbol[symbol];
                const active = selected === symbol;
                const item = PSX_INDEX_THEMES[symbol];
                const tabLoading = active && isSelectedLoading;
                const change = loaded?.change ?? card?.change ?? null;
                return (
                  <button
                    key={symbol}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={!card}
                    onClick={() => setSelected(symbol)}
                    className={cn(
                      "rounded-xl px-2 py-2.5 text-center transition",
                      active
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      !card && "opacity-40"
                    )}
                  >
                    <p className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold sm:text-sm">
                      {tabLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      {item.label}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[10px] uppercase tracking-wide",
                        active ? "text-white/75" : "text-muted-foreground"
                      )}
                    >
                      {item.short}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-xs font-semibold tabular-nums sm:text-sm",
                        active
                          ? "text-white"
                          : change == null
                            ? "text-muted-foreground"
                            : plColorClass(change)
                      )}
                    >
                      {change == null ? "—" : formatSigned(change, 2)}
                    </p>
                  </button>
                );
              })}
            </div>

            {isSelectedLoading || !displayCard ? (
              <LoadingBlock
                label={`Loading ${theme.label}…`}
                className="min-h-[13.5rem] flex-1"
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {theme.label}
                      <span className="ml-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
                        {theme.short}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl",
                        plColorClass(displayCard.changePct)
                      )}
                    >
                      {formatNumber(displayCard.current, 2)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ChangePill value={displayCard.changePct} />
                    <p className={cn("text-sm font-semibold tabular-nums", plColorClass(displayCard.change))}>
                      {formatSigned(displayCard.change, 2)} pts
                    </p>
                  </div>
                </div>

                <IndexSessionStats card={displayCard} />
              </div>
            )}

            <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">
                {isSelectedLoading
                  ? `Fetching ${theme.label} details…`
                  : "Day high, day low, previous close and volume"}
              </p>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/market">Open market</Link>
              </Button>
            </div>
          </>
        ) : (
          <LoadingBlock label="Loading PSX indexes…" className="min-h-44" />
        )}
      </CardContent>
    </Card>
  );
}

function IndexSessionStats({ card }: { card: PsxIndexSnapshot }) {
  const stats = [
    {
      key: "high",
      label: "Day high",
      value: card.high == null ? "—" : formatNumber(card.high, 2),
    },
    {
      key: "low",
      label: "Day low",
      value: card.low == null ? "—" : formatNumber(card.low, 2),
    },
    {
      key: "prev",
      label: "Prev close",
      value: card.prevClose == null ? "—" : formatNumber(card.prevClose, 2),
    },
    {
      key: "volume",
      label: "Volume",
      value: card.volume == null ? "—" : formatCompact(card.volume),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.key}
          className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {stat.label}
          </p>
          <p className="mt-1.5 text-sm font-bold tabular-nums text-foreground sm:text-base">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PortfolioHeroCard({ data, className }: { data?: DashboardData; className?: string }) {
  const holdings = data?.dashboard.holdings ?? [];
  const portfolios = data?.dashboard.portfolios ?? [];
  const { liveHoldings } = useLiveHoldings(holdings);
  const summary = React.useMemo(
    () => computeSummary(liveHoldings, data?.dashboard.summary.realizedPL ?? 0),
    [liveHoldings, data?.dashboard.summary.realizedPL]
  );

  const portfolioRows = React.useMemo(() => {
    return portfolios.map((portfolio) => {
      const rows = liveHoldings.filter((holding) => holding.portfolio_id === portfolio.id);
      const value = rows.reduce((sum, holding) => sum + holding.marketValue, 0);
      const dayChange = rows.reduce((sum, holding) => sum + holding.dayChange, 0);
      const prevValue = value - dayChange;
      const dayChangePct = prevValue !== 0 ? (dayChange / prevValue) * 100 : 0;
      return {
        id: portfolio.id,
        name: portfolio.name,
        positions: rows.length,
        value,
        dayChange,
        dayChangePct,
      };
    });
  }, [liveHoldings, portfolios]);

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden border border-violet-200/35 bg-gradient-to-br from-violet-50/35 via-card to-sky-50/25 dark:border-violet-800/25 dark:from-violet-950/15 dark:via-card dark:to-sky-950/10",
        className
      )}
    >
      <div className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl" aria-hidden />

      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <IconChip accent="violet" variant="gradient">
              <Wallet />
            </IconChip>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Your books
              </p>
              <CardTitle className="mt-1 text-xl">Portfolio overview</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.holdingsCount} positions · {portfolios.length} workspaces
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-9 shrink-0">
            <Link href="/portfolios" aria-label="Open portfolios">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col gap-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Total value
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
              {formatPKR(summary.totalValue)}
            </p>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums",
                summary.dayPL < 0
                  ? "bg-loss/10 text-loss"
                  : summary.dayPL > 0
                    ? "bg-gain/10 text-gain"
                    : "bg-muted text-muted-foreground"
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-75">Today</span>
              <span>{formatPKR(summary.dayPL, { sign: true })}</span>
              <span className="opacity-80">{formatPercent(summary.dayPLPct)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-background/70 p-1 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border/60">
          {[
            {
              key: "day",
              label: "Day's P/L",
              value: formatPKR(summary.dayPL, { sign: true }),
              badge: formatPercent(summary.dayPLPct),
              tone: summary.dayPL,
            },
            {
              key: "total",
              label: "Total P/L",
              value: formatPKR(summary.totalPL, { sign: true }),
              badge: formatPercent(summary.totalPLPct),
              tone: summary.totalPL,
            },
            {
              key: "invested",
              label: "Invested",
              value: formatPKR(summary.totalInvested),
              badge: `Realized ${formatPKR(summary.realizedPL, { sign: true })}`,
              tone: null as number | null,
            },
          ].map((metric) => (
            <div key={metric.key} className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {metric.label}
              </p>
              <p
                className={cn(
                  "mt-1.5 text-lg font-bold tracking-tight tabular-nums",
                  metric.tone != null && plColorClass(metric.tone)
                )}
              >
                {metric.value}
              </p>
              <p
                className={cn(
                  "mt-1 text-xs font-medium tabular-nums",
                  metric.tone != null ? plColorClass(metric.tone) : "text-muted-foreground"
                )}
              >
                {metric.badge}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Your portfolios</p>
            <Link
              href="/portfolios"
              className="text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-300"
            >
              View all →
            </Link>
          </div>

          {portfolioRows.length > 0 ? (
            <div className="space-y-2">
              {portfolioRows.map((portfolio, index) => (
                <Link
                  key={portfolio.id}
                  href={`/portfolios/${portfolio.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 px-3.5 py-3 transition hover:border-violet-300/50 hover:bg-violet-500/[0.04]"
                >
                  <IconChip
                    accent={(["violet", "sky", "primary", "amber"] as Accent[])[index % 4]}
                    size="sm"
                    className="size-10 shrink-0 rounded-xl text-xs font-bold"
                  >
                    <span aria-hidden>{portfolioInitials(portfolio.name)}</span>
                  </IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight">
                      {prettyPortfolioName(portfolio.name)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {portfolio.positions} positions · {formatPKR(portfolio.value)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-sm font-semibold tabular-nums", plColorClass(portfolio.dayChange))}>
                      {formatPKR(portfolio.dayChange, { sign: true })}
                    </p>
                    <p className={cn("mt-0.5 text-xs font-semibold tabular-nums", plColorClass(portfolio.dayChangePct))}>
                      {formatPercent(portfolio.dayChangePct)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
              No portfolios yet — create one to track day change here.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PakistanDailyStrip({
  pkRates,
  fuel,
  oil,
}: {
  pkRates?: PkCommoditiesData;
  fuel?: PakistanFuelData;
  oil?: GlobalMarketData;
}) {
  const petrol = fuel?.current.find((item) => /petrol/i.test(item.label));
  const brent = oil?.quotes.find((quote) => quote.symbol.toUpperCase() === "BZ=F") ?? null;

  const tiles = [
    {
      key: "gold",
      label: "Gold 24K",
      hint: "Pakistan sarafa",
      href: "/market/commodities",
      accent: "amber" as Accent,
      tone: "from-amber-400/[0.06] to-transparent",
      border: "border-amber-300/40 dark:border-amber-500/25",
      icon: <Gem className="size-4" />,
      value: pkRates?.gold24?.pricePerTola != null ? formatPKR(pkRates.gold24.pricePerTola, { decimals: 0 }) : null,
      unit: "per tola",
      change: pkRates?.gold24?.changePerTola ?? null,
      changeLabel: (n: number) => `${formatSigned(n, 0)} /tola`,
    },
    {
      key: "silver",
      label: "Silver",
      hint: "Local rate",
      href: "/market/commodities",
      accent: "slate" as Accent,
      tone: "from-slate-400/[0.05] to-transparent",
      border: "border-slate-300/45 dark:border-slate-500/25",
      icon: <Gem className="size-4" />,
      value: pkRates?.silver?.pricePerTola != null ? formatPKR(pkRates.silver.pricePerTola, { decimals: 0 }) : null,
      unit: "per tola",
      change: pkRates?.silver?.changePerTola ?? null,
      changeLabel: (n: number) => `${formatSigned(n, 0)} /tola`,
    },
    {
      key: "brent",
      label: "Brent crude",
      hint: "Global oil",
      href: "/market/oil",
      accent: "orange" as Accent,
      tone: "from-orange-400/[0.06] to-transparent",
      border: "border-orange-300/40 dark:border-orange-500/25",
      icon: <Droplets className="size-4" />,
      value: brent ? formatMarketPrice(brent.price, brent.currency) : null,
      unit: "USD / barrel",
      change: brent?.changePct ?? null,
      changeLabel: (n: number) => formatPercent(n),
    },
    {
      key: "petrol",
      label: "Petrol",
      hint: fuel?.effectiveDate ? `w.e.f ${fuel.effectiveDate}` : "OGRA",
      href: "/market/oil",
      accent: "rose" as Accent,
      tone: "from-rose-400/[0.05] to-transparent",
      border: "border-rose-300/40 dark:border-rose-500/25",
      icon: <Fuel className="size-4" />,
      value: petrol?.newPrice != null ? formatPKR(petrol.newPrice) : null,
      unit: "per litre",
      change: petrol?.signedChange ?? null,
      changeLabel: (n: number) => formatSigned(n, 2),
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-50/40 via-background to-orange-50/30 p-3.5 dark:border-amber-800/25 dark:from-amber-950/15 dark:via-background dark:to-orange-950/10 sm:p-5">
      <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-amber-200/15 blur-3xl dark:bg-amber-500/8" aria-hidden />
      <div className="pointer-events-none absolute -right-8 bottom-0 h-24 w-24 rounded-full bg-orange-200/12 blur-3xl dark:bg-orange-500/8" aria-hidden />

      <div className="relative space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 sm:gap-3">
          <HubSectionHeading
            accent="amber"
            icon={<Sparkles className="size-3.5" />}
            eyebrow="Everyday movers"
            title="Today's key rates"
            description="Gold, silver, Brent crude and petrol — prices that move every day"
            compact
          />
          {pkRates?.source ? (
            <p className="hidden text-xs text-muted-foreground sm:block">{pkRates.source}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              href={tile.href}
              className={cn(
                "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 transition duration-200 active:scale-[0.99] sm:p-4 sm:hover:-translate-y-0.5 sm:hover:bg-white/70 dark:hover:bg-white/5",
                tile.tone,
                tile.border
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold tracking-tight text-foreground sm:text-sm">
                    {tile.label}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">{tile.hint}</p>
                </div>
                <IconChip accent={tile.accent} size="sm" className="size-7 shrink-0 sm:size-8">
                  {tile.icon}
                </IconChip>
              </div>

              {tile.value ? (
                <div className="mt-3 space-y-1 sm:mt-4 sm:space-y-1.5">
                  <p className="text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{tile.value}</p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs">
                    <span className="text-muted-foreground">{tile.unit}</span>
                    {tile.change != null ? (
                      <span className={cn("font-semibold tabular-nums", plColorClass(tile.change))}>
                        {tile.changeLabel(tile.change)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : (
                <LoadingBlock label="…" className="mt-3 min-h-12 sm:mt-4 sm:min-h-14" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketPulseCard({
  us,
  world,
}: {
  us?: GlobalMarketData;
  world?: GlobalMarketData;
}) {
  const indexes = famousWorldIndexes(us, world);

  return (
    <Card className="flex h-full min-h-[28rem] flex-col overflow-hidden border-border/70 sm:min-h-[34rem]">
      <CardHeader className="shrink-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base sm:text-lg">World indexes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Major boards around the globe</p>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link href="/market/world" aria-label="Open world markets">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
        {indexes.length ? (
          <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80 bg-muted/20">
            {indexes.map((quote) => (
              <div key={quote.symbol} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {famousIndexLabel(quote)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {quote.country ?? quote.region ?? quote.currency ?? "Index"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatMarketPrice(quote.price, quote.currency)}
                  </p>
                  <p className={cn("text-xs font-semibold tabular-nums", plColorClass(quote.changePct))}>
                    {formatPercent(quote.changePct)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <LoadingBlock label="Loading indexes…" className="min-h-28 flex-1" />
        )}
      </CardContent>
    </Card>
  );
}

const FAMOUS_WORLD_INDEX_SYMBOLS = [
  "^GSPC",
  "^DJI",
  "^NDX",
  "^FTSE",
  "^GDAXI",
  "^N225",
  "^HSI",
  "000001.SS",
  "^NSEI",
] as const;

const FAMOUS_INDEX_LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  "^NDX": "Nasdaq 100",
  "^FTSE": "FTSE 100",
  "^GDAXI": "DAX",
  "^N225": "Nikkei 225",
  "^HSI": "Hang Seng",
  "000001.SS": "Shanghai",
  "^NSEI": "NIFTY 50",
};

function famousWorldIndexes(us?: GlobalMarketData, world?: GlobalMarketData) {
  const bySymbol = new Map<string, GlobalQuote>();
  for (const quote of [...(us?.quotes ?? []), ...(world?.quotes ?? [])]) {
    bySymbol.set(quote.symbol.toUpperCase(), quote);
  }
  return FAMOUS_WORLD_INDEX_SYMBOLS.map((symbol) => bySymbol.get(symbol.toUpperCase())).filter(
    (quote): quote is GlobalQuote => Boolean(quote)
  );
}

function famousIndexLabel(quote: GlobalQuote) {
  return FAMOUS_INDEX_LABELS[quote.symbol.toUpperCase()] ?? quote.name;
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
    <Card className="h-full min-h-[26rem] overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:min-h-[30rem]">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11 sm:rounded-2xl [&>svg]:size-5",
                ACCENT_GRADIENT[accent]
              )}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold leading-tight sm:text-xl sm:font-medium">{title}</CardTitle>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
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
        <div className="flex min-h-20 flex-col items-start justify-end gap-2 sm:flex-row sm:items-end sm:justify-between">
          {featured ? (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                {featured.label}
              </p>
              <p
                className={cn(
                  "mt-1 break-words text-xl font-semibold leading-tight tabular-nums sm:text-xl sm:font-medium",
                  plColorClass(featured.changePct)
                )}
              >
                {featured.value}
              </p>
              <p
                className={cn(
                  "mt-0.5 break-words text-sm font-medium leading-tight tabular-nums sm:text-xs",
                  plColorClass(featured.changePct)
                )}
              >
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

        <div className="mt-4 h-[16.5rem] overflow-hidden sm:mt-5 sm:h-[20rem]">
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
            <LoadingBlock label="Loading live data…" className="h-full" />
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
  const [expanded, setExpanded] = React.useState(false);

  const expandControl = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className="size-9 border border-white/70 bg-white/95 shadow-sm hover:bg-white sm:size-10"
      onClick={() => setExpanded(true)}
      disabled={!data}
      aria-label="Expand world map"
    >
      <Maximize2 className="size-4" />
    </Button>
  );

  return (
    <>
      <Card className="flex h-full min-h-[28rem] flex-col gap-3 overflow-hidden border-border/70 pb-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg sm:min-h-[34rem]">
        <CardHeader className="shrink-0 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl sm:size-11", ACCENT_GRADIENT.indigo)}>
                <Globe2 className="size-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg leading-tight sm:text-xl">{title}</CardTitle>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
                  {eyebrow}
                </p>
              </div>
            </div>
            <Button asChild variant="ghost" size="icon" className="size-9 shrink-0 sm:size-10">
              <Link href={href} aria-label={`Open ${title} page`}>
                <ArrowRight className="size-4 sm:size-5" />
              </Link>
            </Button>
          </div>

          {featured ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-border/80 bg-muted/30 px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
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

        <CardContent className="flex min-h-0 flex-1 flex-col px-0 pb-0">
          {data ? (
            <div className="min-h-0 flex-1">
              <WorldMarketHeatMap
                data={data}
                compact
                fillHeight
                hideRegionFilters
                hideLegend
                hideExchangeBadge
                mapAction={expandControl}
              />
            </div>
          ) : (
            <LoadingBlock label="Loading world map…" className="mx-4 mb-4 min-h-[18rem] flex-1 sm:min-h-[28rem]" />
          )}
        </CardContent>
      </Card>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton
          className="flex h-[min(94dvh,900px)] w-[min(98vw,1400px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(98vw,1400px)] sm:rounded-2xl"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/70 px-4 py-3 pr-12 text-left sm:px-5">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Globe2 className="size-5 text-indigo-500" />
              World map
            </DialogTitle>
            <DialogDescription>
              Drag to pan · scroll or pinch to zoom
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 bg-[#d8e6f5] dark:bg-slate-900">
            {data ? (
              <WorldMarketHeatMap
                data={data}
                explorer
                fillHeight
                hideRegionFilters
                hideLegend
                hideExchangeBadge
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DashboardRowItem({ row, ariaHidden }: { row: DashboardRow; ariaHidden?: boolean }) {
  const content = (
    <div
      aria-hidden={ariaHidden}
      className="flex min-h-[4rem] items-center justify-between gap-3 rounded-xl border border-border bg-muted/35 px-3 py-2.5 sm:min-h-[3.85rem] sm:gap-3 sm:px-3 sm:py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight sm:text-base sm:font-medium">{row.symbol}</p>
        <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground sm:text-sm">{row.name}</p>
      </div>
      <div className="min-w-[5.5rem] shrink-0 text-right sm:min-w-[6.25rem]">
        <p className={cn("truncate text-sm font-semibold leading-tight tabular-nums sm:text-sm sm:font-medium", plColorClass(row.changePct))}>
          {row.value}
        </p>
        <p className={cn("mt-0.5 truncate text-xs font-medium leading-snug tabular-nums sm:text-xs", plColorClass(row.changePct))}>
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
      <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground sm:px-2.5 sm:text-xs">
        Updating
      </span>
    );
  }
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold tabular-nums sm:px-2.5 sm:text-xs sm:font-medium",
        value < 0 ? "bg-loss/10 text-loss" : value > 0 ? "bg-gain/10 text-gain" : "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-3" />
      {formatPercent(value)}
    </span>
  );
}

function LoadingBlock({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground",
        className
      )}
    >
      <Loader2 className="mr-2 size-4 animate-spin" />
      {label}
    </div>
  );
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

const PSX_BLUE_CHIP_SYMBOLS = [
  "FFC",
  "ENGRO",
  "OGDC",
  "MARI",
  "PPL",
  "HBL",
  "UBL",
  "MEBL",
  "MCB",
  "LUCK",
  "PSO",
  "SYS",
  "HUBC",
  "BAHL",
  "MTL",
  "NESTLE",
] as const;

function featuredPsxBlueChip(
  data: PublicMarketData | undefined,
  symbol: string
): FeaturedMarketMove | null {
  const quote = psxMarketQuoteMap(data).get(symbol.toUpperCase());
  if (!quote) return null;
  return {
    label: quote.symbol,
    value: formatNumber(quote.price, 2),
    change: formatSigned(quote.change, 2),
    changePct: quote.changePct,
  };
}

function psxBlueChipRows(data: PublicMarketData | undefined): DashboardRow[] {
  const bySymbol = psxMarketQuoteMap(data);
  return PSX_BLUE_CHIP_SYMBOLS.map((symbol) => bySymbol.get(symbol))
    .filter((quote): quote is NonNullable<typeof quote> => Boolean(quote))
    .map((quote) => ({
      id: quote.symbol,
      symbol: quote.symbol,
      name: quote.name ?? getSeedTicker(quote.symbol)?.company ?? quote.symbol,
      value: formatNumber(quote.price, 2),
      change: formatSigned(quote.change, 2),
      changePct: quote.changePct,
      href: `/stocks/${encodeURIComponent(quote.symbol)}`,
    }));
}

function psxMarketQuoteMap(data: PublicMarketData | undefined) {
  const bySymbol = new Map<
    string,
    { symbol: string; name: string | null; price: number; change: number; changePct: number }
  >();

  for (const sector of data?.analytics.sectors ?? []) {
    for (const stock of sector.stocks ?? []) {
      bySymbol.set(stock.symbol.toUpperCase(), {
        symbol: stock.symbol.toUpperCase(),
        name: stock.name,
        price: stock.price,
        change: stock.change,
        changePct: stock.changePct,
      });
    }
  }

  for (const performer of [
    ...(data?.analytics.performers.active ?? []),
    ...(data?.analytics.performers.advancers ?? []),
    ...(data?.analytics.performers.decliners ?? []),
  ]) {
    const key = performer.symbol.toUpperCase();
    if (bySymbol.has(key)) continue;
    bySymbol.set(key, {
      symbol: key,
      name: getSeedTicker(key)?.company ?? null,
      price: performer.price,
      change: performer.change,
      changePct: performer.changePct,
    });
  }

  return bySymbol;
}

function featuredQuote(data: GlobalMarketData | undefined, symbol: string): FeaturedMarketMove | null {
  const quote = data?.quotes.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
  return quote ? featuredQuoteMove(quote, symbol.toUpperCase() === "BTC" ? "symbol" : "name") : null;
}

function featuredQuoteMove(quote: GlobalQuote, labelMode: "name" | "symbol" = "name"): FeaturedMarketMove {
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

function newestTimestamp(values: Array<string | undefined>) {
  const times = values
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
    .filter((value) => Number.isFinite(value));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function formatClock(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-PK", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Karachi",
    });
  } catch {
    return "";
  }
}
