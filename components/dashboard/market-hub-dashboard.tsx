"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bitcoin,
  Briefcase,
  CalendarClock,
  Coins,
  Droplets,
  Fuel,
  Gem,
  Globe2,
  Landmark,
  LineChart,
  Loader2,
  Maximize2,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { IndexTickerStrip, type DashboardTickerItem } from "@/components/dashboard/index-ticker-strip";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { WorldMarketHeatMap } from "@/components/market/world-market-heat-map";
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
import {
  isPortfolioCacheFresh,
  PORTFOLIO_MUTATION_EVENT,
} from "@/lib/cache/portfolio-mutations";
import {
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
import type { FipiLipiData } from "@/lib/types/fipi-lipi";
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

  const portfolio = usePersistentResource<DashboardData>({
    cacheKey: `private:dashboard:${userId}`,
    url: "/api/private/dashboard",
    refreshInterval: REFRESH_MS,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: acceptPortfolioCache,
  });
  const psx = usePublicHub<PublicMarketData>("public:psx-market:v3", "/api/public/market", cacheClosedOnly);
  const us = usePublicHub<GlobalMarketData>("public:global-market:us", "/api/public/global-market/us", cacheClosedOnly);
  const india = usePublicHub<GlobalMarketData>("public:global-market:india", "/api/public/global-market/india", cacheClosedOnly);
  const world = usePublicHub<GlobalMarketData>("public:global-market:world", "/api/public/global-market/world", cacheClosedOnly);
  const commodities = usePublicHub<GlobalMarketData>(
    "public:global-market:commodities",
    "/api/public/global-market/commodities",
    cacheClosedOnly
  );
  const oil = usePublicHub<GlobalMarketData>("public:global-market:oil", "/api/public/global-market/oil", cacheClosedOnly);
  const crypto = usePublicHub<GlobalMarketData>(
    "public:global-market:crypto",
    "/api/public/global-market/crypto",
    cacheClosedOnly
  );
  const pkRates = usePersistentResource<PkCommoditiesData>({
    cacheKey: "public:pk-commodities-v12",
    url: "/api/public/pakistan-commodities",
    refreshInterval: PK_RATES_REFRESH_MS,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: cacheClosedOnly,
  });
  const fuel = usePersistentResource<PakistanFuelData>({
    cacheKey: "public:pk-fuel-prices-v1",
    url: "/api/public/pakistan-fuel-prices",
    refreshInterval: FUEL_REFRESH_MS,
    acceptCacheWhen: () => true,
  });
  const fipi = usePersistentResource<FipiLipiData>({
    cacheKey: "public:fipi-lipi-v9",
    url: "/api/public/fipi-lipi",
    refreshInterval: REFRESH_MS * 5,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: cacheClosedOnly,
  });

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
    fipi: fipi.data ?? undefined,
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
      {
        id: "fipi",
        label: "Foreign & local flows",
        detail: "Latest FIPI / LIPI session totals",
        run: async () => {
          const next = await fipi.refreshNow({ url: "/api/public/fipi-lipi?fresh=1" });
          return next.latest ? `Flows for ${next.latest.date}` : "Flow board updated";
        },
      },
    ],
    [commodities, crypto, fipi, fuel, india, oil, pkRates, portfolio, psx, us, world]
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

      <PakistanDailyStrip pkRates={data.pkRates} fuel={data.fuel} oil={data.oil} />

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
    </div>
  );
}

function usePublicHub<T>(cacheKey: string, url: string, cacheClosedOnly: () => boolean) {
  return usePersistentResource<T>({
    cacheKey,
    url,
    refreshInterval: REFRESH_MS,
    pauseWhen: cacheClosedOnly,
    acceptCacheWhen: cacheClosedOnly,
  });
}

function SessionBadge({ label, status }: { label: string; status: string }) {
  const live = status === "open" || status === "pre-open";
  return (
    <span
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
      PSX {label}
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
    shell:
      "border border-emerald-300/35 bg-emerald-500/[0.04] dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]",
    glow: "bg-emerald-400/10",
    bar: "from-emerald-400/70 to-teal-300/50",
  },
  KMI30: {
    label: "KMI 30",
    short: "Shariah",
    shell:
      "border border-sky-300/35 bg-sky-500/[0.04] dark:border-sky-500/20 dark:bg-sky-500/[0.06]",
    glow: "bg-sky-400/10",
    bar: "from-sky-400/70 to-indigo-300/50",
  },
  KSE30: {
    label: "KSE 30",
    short: "Blue chips",
    shell:
      "border border-violet-300/35 bg-violet-500/[0.04] dark:border-violet-500/20 dark:bg-violet-500/[0.06]",
    glow: "bg-violet-400/10",
    bar: "from-violet-400/70 to-fuchsia-300/50",
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
  const indexes = (["KSE100", "KMI30", "KSE30"] as const).map((symbol) => {
    const fromCards = cards?.find((card) => card.symbol === symbol) ?? null;
    if (symbol === "KSE100" && detail) {
      return {
        symbol,
        name: detail.name || fromCards?.name || "KSE 100 Index",
        current: detail.current,
        change: detail.change,
        changePct: detail.changePct,
        week52High: detail.week52High ?? fromCards?.week52High,
        week52Low: detail.week52Low ?? fromCards?.week52Low,
      } satisfies IndexCardData;
    }
    return fromCards;
  });
  const [kse100, kmi30, kse30] = indexes;
  const ready = Boolean(kse100 || kmi30 || kse30);
  const [selected, setSelected] = React.useState<PsxIndexSymbol>("KSE100");
  const [fetchedRange, setFetchedRange] = React.useState<
    Partial<Record<PsxIndexSymbol, { week52High: number; week52Low: number }>>
  >({});

  const selectedCard =
    selected === "KSE100" ? kse100 : selected === "KMI30" ? kmi30 : kse30;

  React.useEffect(() => {
    if (selectedCard) return;
    if (kse100) setSelected("KSE100");
    else if (kmi30) setSelected("KMI30");
    else if (kse30) setSelected("KSE30");
  }, [kse100, kmi30, kse30, selectedCard]);

  const week52High = selectedCard?.week52High ?? fetchedRange[selected]?.week52High;
  const week52Low = selectedCard?.week52Low ?? fetchedRange[selected]?.week52Low;
  const needsFetch = Boolean(selectedCard) && (week52High == null || week52Low == null);

  React.useEffect(() => {
    if (!needsFetch) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/index/${selected}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          week52High?: number;
          week52Low?: number;
        };
        if (cancelled || data.week52High == null || data.week52Low == null) return;
        setFetchedRange((prev) => {
          if (prev[selected]) return prev;
          return {
            ...prev,
            [selected]: {
              week52High: data.week52High!,
              week52Low: data.week52Low!,
            },
          };
        });
      } catch {
        // Keep empty state; bar shows unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsFetch, selected]);

  const rangeCard: IndexCardData | null = selectedCard
    ? {
        ...selectedCard,
        week52High,
        week52Low,
      }
    : null;

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden border border-emerald-200/40 bg-gradient-to-br from-emerald-50/50 via-card to-sky-50/40 dark:border-emerald-800/30 dark:from-emerald-950/20 dark:via-card dark:to-sky-950/15",
        className
      )}
    >
      <div className="pointer-events-none absolute -left-8 top-0 h-28 w-28 rounded-full bg-emerald-300/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-0 top-8 h-24 w-24 rounded-full bg-sky-300/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 right-10 h-20 w-20 rounded-full bg-violet-300/10 blur-3xl" aria-hidden />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <IconChip accent="primary" variant="gradient">
              <Landmark />
            </IconChip>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Pakistan Stock Exchange
              </p>
              <CardTitle className="mt-1 text-xl">Key indexes</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{marketLabel}</p>
            </div>
          </div>
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link href="/market" aria-label="Open PSX market">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative flex flex-1 flex-col space-y-3">
        {ready ? (
          <>
            <PsxIndexTile
              card={kse100}
              symbol="KSE100"
              featured
              selected={selected === "KSE100"}
              onSelect={setSelected}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PsxIndexTile
                card={kmi30}
                symbol="KMI30"
                selected={selected === "KMI30"}
                onSelect={setSelected}
              />
              <PsxIndexTile
                card={kse30}
                symbol="KSE30"
                selected={selected === "KSE30"}
                onSelect={setSelected}
              />
            </div>
            <IndexWeekRangeBar
              symbol={selected}
              card={rangeCard}
              className="mt-auto pt-2"
            />
          </>
        ) : (
          <LoadingBlock label="Loading PSX indexes…" className="min-h-44" />
        )}
      </CardContent>
    </Card>
  );
}

function IndexWeekRangeBar({
  symbol,
  card,
  className,
}: {
  symbol: PsxIndexSymbol;
  card: IndexCardData | null;
  className?: string;
}) {
  const theme = PSX_INDEX_THEMES[symbol];
  const high = card?.week52High;
  const low = card?.week52Low;
  const current = card?.current;

  if (card == null || high == null || low == null || current == null) {
    return (
      <div className={cn("rounded-2xl border border-border/70 bg-muted/25 px-4 py-3", className)}>
        <p className="text-xs text-muted-foreground">52-week range unavailable for {theme.label}</p>
      </div>
    );
  }

  const span = Math.max(high - low, 1);
  const pos = Math.min(100, Math.max(0, ((current - low) / span) * 100));
  const fromLowPct = ((current - low) / span) * 100;
  const toHighPct = ((high - current) / span) * 100;

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-white/50 px-4 py-3.5 dark:bg-white/5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            52-week range
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{theme.label}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums text-foreground">{pos.toFixed(0)}%</p>
          <p className="text-[11px] text-muted-foreground">of range</p>
        </div>
      </div>

      <div className="relative mt-4 h-2.5 w-full rounded-full bg-gradient-to-r from-rose-400/35 via-amber-300/30 to-emerald-400/40">
        <div
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-sm"
          style={{ left: `${pos}%` }}
          aria-hidden
        />
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-3 text-xs tabular-nums">
        <div>
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">Low</p>
          <p className="mt-0.5 font-semibold text-foreground">{formatNumber(low, 0)}</p>
        </div>
        <div className="text-center">
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">Now</p>
          <p className={cn("mt-0.5 font-semibold", plColorClass(card.changePct))}>
            {formatNumber(current, 0)}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {fromLowPct >= 50
              ? `${toHighPct.toFixed(0)}% below high`
              : `${fromLowPct.toFixed(0)}% above low`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold uppercase tracking-wide text-muted-foreground">High</p>
          <p className="mt-0.5 font-semibold text-foreground">{formatNumber(high, 0)}</p>
        </div>
      </div>
    </div>
  );
}

function PsxIndexTile({
  card,
  symbol,
  featured = false,
  selected = false,
  onSelect,
}: {
  card: IndexCardData | null;
  symbol: PsxIndexSymbol;
  featured?: boolean;
  selected?: boolean;
  onSelect: (symbol: PsxIndexSymbol) => void;
}) {
  const theme = PSX_INDEX_THEMES[symbol];

  if (!card) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl p-3", theme.shell)}>
        <LoadingBlock label={`Loading ${theme.label}…`} className={featured ? "min-h-28" : "min-h-20"} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(symbol)}
      aria-pressed={selected}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl text-left transition duration-200 hover:-translate-y-0.5",
        theme.shell,
        featured ? "p-3.5 sm:p-5" : "p-3 sm:p-3.5",
        selected && "ring-2 ring-emerald-500/70 ring-offset-2 ring-offset-background"
      )}
    >
      <div className={cn("pointer-events-none absolute -right-6 -top-8 size-20 rounded-full blur-3xl", theme.glow)} aria-hidden />
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-70", theme.bar)} aria-hidden />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-semibold tracking-tight", featured ? "text-sm sm:text-lg" : "text-sm")}>
              {theme.label}
            </p>
            <span className="rounded-full border border-white/40 bg-white/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur dark:border-white/10 dark:bg-white/5">
              {theme.short}
            </span>
          </div>
          <p
            className={cn(
              "mt-2 font-bold tracking-tight tabular-nums",
              featured ? "text-2xl sm:text-4xl" : "text-xl sm:text-2xl",
              plColorClass(card.changePct)
            )}
          >
            {formatNumber(card.current, 2)}
          </p>
        </div>
        <ChangePill value={card.changePct} />
      </div>

      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-xs font-semibold tabular-nums sm:text-sm", plColorClass(card.change))}>
          {formatSigned(card.change, 2)} pts
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {selected ? "Showing 52W range" : "Tap for 52W range"}
        </span>
      </div>
    </button>
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

  const metricCards = [
    {
      key: "day",
      label: "Day's P/L",
      value: formatPKR(summary.dayPL, { sign: true }),
      tone: summary.dayPL,
      badge: formatPercent(summary.dayPLPct),
      icon: <CalendarClock className="size-4" />,
      accent: "sky" as Accent,
    },
    {
      key: "total",
      label: "Total P/L",
      value: formatPKR(summary.totalPL, { sign: true }),
      tone: summary.totalPL,
      badge: formatPercent(summary.totalPLPct),
      icon: <TrendingUp className="size-4" />,
      accent: "violet" as Accent,
    },
    {
      key: "invested",
      label: "Invested",
      value: formatPKR(summary.totalInvested),
      tone: null as number | null,
      badge: `Realized ${formatPKR(summary.realizedPL, { sign: true })}`,
      icon: <Coins className="size-4" />,
      accent: "amber" as Accent,
    },
  ];

  return (
    <Card className={cn("relative overflow-hidden border-border/70 bg-card", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <IconChip accent="violet" variant="gradient" className="size-10 shrink-0 sm:size-11">
              <Wallet />
            </IconChip>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Your books
              </p>
              <CardTitle className="mt-1 text-lg sm:text-xl">Portfolio overview</CardTitle>
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

      <CardContent className="space-y-3 sm:space-y-4">
        {/* Hero total value */}
        <div className="rounded-2xl border border-border/80 bg-muted/25 p-3.5 sm:px-5 sm:py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">
            Total value
          </p>
          <p className="mt-1 text-[1.55rem] font-bold leading-none tracking-tight tabular-nums sm:mt-1.5 sm:text-3xl">
            {formatPKR(summary.totalValue)}
          </p>
          <div
            className={cn(
              "mt-3 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold tabular-nums sm:mt-3.5 sm:w-auto sm:inline-flex sm:justify-start sm:rounded-full sm:py-1.5",
              summary.dayPL < 0
                ? "bg-loss/10 text-loss"
                : summary.dayPL > 0
                  ? "bg-gain/10 text-gain"
                  : "bg-muted text-muted-foreground"
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Today</span>
            <span className="flex items-center gap-2">
              <span>{formatPKR(summary.dayPL, { sign: true })}</span>
              <span className="opacity-80">{formatPercent(summary.dayPLPct)}</span>
            </span>
          </div>
        </div>

        {/* Supporting metrics — 2-up on mobile, 3-up on desktop */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
          {metricCards.map((metric, index) => (
            <div
              key={metric.key}
              className={cn(
                "rounded-2xl border border-border/80 bg-background p-3 shadow-xs sm:px-3.5 sm:py-3",
                index === 2 && "col-span-2 sm:col-span-1"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-muted-foreground sm:text-xs">{metric.label}</p>
                <IconChip accent={metric.accent} size="sm" className="size-6 rounded-md sm:size-7 sm:rounded-lg">
                  {metric.icon}
                </IconChip>
              </div>
              <p
                title={metric.value}
                className={cn(
                  "mt-1.5 text-base font-bold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] sm:mt-2 sm:text-lg",
                  metric.tone != null && plColorClass(metric.tone)
                )}
              >
                {metric.value}
              </p>
              <p
                className={cn(
                  "mt-1 text-[11px] font-semibold tabular-nums sm:text-xs",
                  metric.tone != null ? plColorClass(metric.tone) : "text-muted-foreground"
                )}
              >
                {metric.badge}
              </p>
            </div>
          ))}
        </div>

        {/* Portfolio list */}
        {portfolioRows.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <HubSectionHeading
                accent="violet"
                icon={<Briefcase className="size-3.5" />}
                eyebrow="Workspaces"
                title="Your portfolios"
                compact
              />
              <Link
                href="/portfolios"
                className="shrink-0 text-xs font-semibold text-violet-600/90 hover:text-violet-700 dark:text-violet-300"
              >
                View all →
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border/80 bg-background">
              <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,0.7fr)_minmax(6.5rem,0.8fr)] gap-3 border-b border-border/70 bg-muted/30 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
                <span>Portfolio</span>
                <span className="text-right">Value</span>
                <span className="text-right">Today</span>
              </div>
              <div className="divide-y divide-border/70">
                {portfolioRows.map((portfolio, index) => (
                  <Link
                    key={portfolio.id}
                    href={`/portfolios/${portfolio.id}`}
                    className="flex items-center gap-3 px-3 py-3 transition active:bg-muted/40 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(5.5rem,0.7fr)_minmax(6.5rem,0.8fr)] sm:gap-3 sm:px-3.5 sm:hover:bg-muted/35"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <IconChip
                        accent={(["violet", "sky", "primary", "amber"] as Accent[])[index % 4]}
                        size="sm"
                        className="size-9 shrink-0 rounded-xl text-[11px] font-bold"
                      >
                        <span aria-hidden>{portfolioInitials(portfolio.name)}</span>
                      </IconChip>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">
                          {prettyPortfolioName(portfolio.name)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                          {portfolio.positions} positions
                          <span className="sm:hidden"> · {formatPKR(portfolio.value)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-semibold tabular-nums">{formatPKR(portfolio.value)}</p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={cn("text-sm font-semibold tabular-nums", plColorClass(portfolio.dayChange))}>
                        {formatPKR(portfolio.dayChange, { sign: true })}
                      </p>
                      <span
                        className={cn(
                          "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                          portfolio.dayChangePct < 0
                            ? "bg-loss/10 text-loss"
                            : portfolio.dayChangePct > 0
                              ? "bg-gain/10 text-gain"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {formatPercent(portfolio.dayChangePct)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
            No portfolios yet — create one to track day change here.
          </div>
        )}
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
