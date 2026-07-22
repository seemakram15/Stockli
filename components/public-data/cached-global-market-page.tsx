"use client";

import * as React from "react";
import {
  Bitcoin,
  Droplets,
  Flame,
  Gem,
  Globe2,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { ViewportLazy } from "@/components/loading/viewport-lazy";
import { GlobalMarketBoard } from "@/components/market/global-market-board";
import { PakistanFuelPricesBoard, type PakFuelBoardHandle } from "@/components/market/pakistan-fuel-prices-board";
import { BrentCrudeChart, type BrentCrudeChartHandle } from "@/components/market/brent-crude-chart";
import { PakistanCommoditiesBoard, type PakCommoditiesBoardHandle } from "@/components/market/pakistan-commodities-board";
import { GlobalCommodityChart, type GlobalCommodityChartHandle } from "@/components/market/global-commodity-chart";
import { CryptoMarketChart, type CryptoMarketChartHandle } from "@/components/market/crypto-market-chart";
import { UsMarketChart, type UsMarketChartHandle } from "@/components/market/us-market-chart";
import { MarketRefreshButton, type RefreshColor } from "@/components/market/market-refresh-button";
import { PageHeader } from "@/components/page-header";
import { type Accent } from "@/components/ui/accent";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { withFreshParam } from "@/lib/hooks/use-refresh-runner";
import type { GlobalMarketData, MarketUniverse } from "@/lib/services/global-markets";

const MARKET_THEME: Record<
  MarketUniverse,
  { accent: Accent; color: RefreshColor; eyebrow: string; Icon: LucideIcon; stages: string[] }
> = {
  us: {
    accent: "sky", color: "sky", eyebrow: "USA markets", Icon: LineChart,
    stages: ["Connecting to US markets", "Fetching index quotes", "Loading price chart", "Updating board"],
  },
  india: {
    accent: "rose", color: "rose", eyebrow: "India markets", Icon: LineChart,
    stages: ["Connecting to India markets", "Fetching index quotes", "Updating board"],
  },
  world: {
    accent: "indigo", color: "indigo", eyebrow: "World indices", Icon: Globe2,
    stages: ["Fetching world exchanges", "Loading country indices", "Updating world board"],
  },
  commodities: {
    accent: "amber", color: "amber", eyebrow: "Commodities", Icon: Gem,
    stages: ["Connecting to commodity feeds", "Scraping Pakistan prices", "Fetching chart histories", "Updating all boards"],
  },
  oil: {
    accent: "orange", color: "orange", eyebrow: "Energy", Icon: Droplets,
    stages: ["Connecting to energy feeds", "Fetching OGRA fuel prices", "Loading Brent crude chart", "Updating energy board"],
  },
  crypto: {
    accent: "violet", color: "violet", eyebrow: "Crypto", Icon: Bitcoin,
    stages: ["Connecting to crypto markets", "Fetching coin prices", "Loading price chart", "Updating crypto board"],
  },
};

export function CachedGlobalMarketPage({
  market,
  title,
  description,
}: {
  market: MarketUniverse;
  title: string;
  description: string;
}) {
  const theme = MARKET_THEME[market] ?? MARKET_THEME.world;
  const ThemeIcon = theme.Icon;
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
    usePersistentResource<GlobalMarketData>({
      cacheKey: `public:global-market:${market}`,
      url: `/api/public/global-market/${market}`,
      refreshInterval: market === "crypto" ? 60_000 : 2 * 60_000,
    });

  const pkCommoditiesRef = React.useRef<PakCommoditiesBoardHandle>(null);
  const globalChartRef = React.useRef<GlobalCommodityChartHandle>(null);
  const pkFuelRef = React.useRef<PakFuelBoardHandle>(null);
  const brentRef = React.useRef<BrentCrudeChartHandle>(null);
  const cryptoChartRef = React.useRef<CryptoMarketChartHandle>(null);
  const usChartRef = React.useRef<UsMarketChartHandle>(null);

  const handleRefreshAll = React.useCallback(async (): Promise<string | void> => {
    const fns: Array<Promise<unknown>> = [
      refreshNow({ url: withFreshParam(`/api/public/global-market/${market}`) }),
    ];
    if (market === "commodities") {
      if (pkCommoditiesRef.current) fns.push(pkCommoditiesRef.current.refresh());
      if (globalChartRef.current) fns.push(globalChartRef.current.refresh());
    } else if (market === "oil") {
      if (pkFuelRef.current) fns.push(pkFuelRef.current.refresh());
      if (brentRef.current) fns.push(brentRef.current.refresh());
    } else if (market === "crypto") {
      if (cryptoChartRef.current) fns.push(cryptoChartRef.current.refresh());
    } else if (market === "us") {
      if (usChartRef.current) fns.push(usChartRef.current.refresh());
    }
    const [mainData] = await Promise.all(fns);
    const count = (mainData as GlobalMarketData | undefined)?.quotes?.length;
    return count ? `${count} quotes refreshed` : undefined;
  }, [market, refreshNow]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<ThemeIcon />}
        eyebrow={theme.eyebrow}
        accent={theme.accent}
        title={data?.title ?? title}
        description={data?.description ?? description}
        actions={
          <>
            <CacheStatusBadge
              updatedAt={latestUpdatedAt(data)}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color={theme.color}
              label="Refresh"
              title={`Refreshing ${title}`}
              description="Force-reloads this market board from the live feed and updates every chart on the page."
              onRefresh={handleRefreshAll}
              stages={theme.stages}
            />
          </>
        }
      />

      {data ? (
        market === "commodities" ? (
          <div className="grid items-stretch gap-5 lg:grid-cols-2">
            {/* Pakistan Commodities — secondary local board, deferred */}
            <ViewportLazy minHeight={420} fallback={<BoardSkeleton />} className="flex h-full min-h-0 min-w-0 flex-col">
              <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/[0.04]">
                <div className="flex shrink-0 items-center gap-3 border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <Gem className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">Pakistan Commodity Prices</p>
                    <p className="text-xs text-muted-foreground">Gold & silver — PKR per tola</p>
                  </div>
                  <MarketRefreshButton
                    color="amber"
                    label="Refresh"
                    onRefresh={() => pkCommoditiesRef.current?.refresh() ?? Promise.resolve()}
                    stages={["Scraping Pakistan prices", "Refreshing price history", "Updating charts"]}
                  />
                </div>
                <div className="min-h-0 flex-1 p-4">
                  <PakistanCommoditiesBoard ref={pkCommoditiesRef} />
                </div>
              </div>
            </ViewportLazy>

            {/* Global Commodities — primary board (uses page-level data) */}
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-sky-500/25 bg-sky-500/[0.04]">
              <div className="flex shrink-0 items-center gap-3 border-b border-sky-500/20 bg-sky-500/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                  <Globe2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Global Commodities</p>
                  <p className="text-xs text-muted-foreground">Metals, agriculture & soft — Yahoo Finance</p>
                </div>
                <MarketRefreshButton
                  color="sky"
                  label="Refresh"
                  onRefresh={() => globalChartRef.current?.refresh() ?? Promise.resolve()}
                  stages={["Fetching commodity chart", "Loading history data", "Updating chart"]}
                />
              </div>
              <div className="min-h-0 flex-1 space-y-4 p-4">
                <GlobalMarketBoard
                  data={data}
                  accent={theme.accent}
                  prioritySymbols={["GC=F","SI=F","HG=F","CL=F","BZ=F","PL=F","PA=F","NG=F","ZC=F","ZW=F","ZS=F","KC=F","CT=F","SB=F"]}
                  priceCardSymbols={["GC=F","SI=F","HG=F","PL=F"]}
                  hideSummaryStats
                  hideCountry
                  chartSlot={
                    <ViewportLazy minHeight={280} fallback={<Skeleton className="h-[280px] w-full rounded-xl" />}>
                      <GlobalCommodityChart ref={globalChartRef} />
                    </ViewportLazy>
                  }
                />
              </div>
            </div>
          </div>
        ) : market === "oil" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Pakistan Fuel Prices — secondary, deferred */}
            <ViewportLazy minHeight={360} fallback={<BoardSkeleton />}>
              <div className="min-w-0 overflow-hidden rounded-2xl border border-orange-500/25 bg-orange-500/[0.04]">
                <div className="flex items-center gap-3 border-b border-orange-500/20 bg-orange-500/[0.06] px-5 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                    <Flame className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">Pakistan Fuel Prices</p>
                    <p className="text-xs text-muted-foreground">OGRA — revised bi-monthly</p>
                  </div>
                  <MarketRefreshButton
                    color="orange"
                    label="Refresh"
                    onRefresh={() => pkFuelRef.current?.refresh() ?? Promise.resolve()}
                    stages={["Connecting to OGRA", "Scraping fuel prices", "Updating price board"]}
                  />
                </div>
                <div className="p-4">
                  <PakistanFuelPricesBoard ref={pkFuelRef} />
                </div>
              </div>
            </ViewportLazy>

            {/* Global Oil Markets — primary board */}
            <div className="min-w-0 overflow-hidden rounded-2xl border border-sky-500/25 bg-sky-500/[0.04]">
              <div className="flex items-center gap-3 border-b border-sky-500/20 bg-sky-500/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                  <Droplets className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">Global Oil Markets</p>
                  <p className="text-xs text-muted-foreground">Live futures — Yahoo Finance</p>
                </div>
                <MarketRefreshButton
                  color="sky"
                  label="Refresh"
                  onRefresh={() => brentRef.current?.refresh() ?? Promise.resolve()}
                  stages={["Fetching Brent crude data", "Loading chart history", "Updating oil chart"]}
                />
              </div>
              <div className="p-4">
                <GlobalMarketBoard
                  data={data}
                  accent={theme.accent}
                  prioritySymbols={["CL=F","BZ=F","NG=F","RB=F","HO=F"]}
                  priceCardSymbols={["CL=F","BZ=F","NG=F","RB=F"]}
                  hideSummaryStats
                  hideCountry
                  chartSlot={
                    <ViewportLazy minHeight={280} fallback={<Skeleton className="h-[280px] w-full rounded-xl" />}>
                      <BrentCrudeChart ref={brentRef} />
                    </ViewportLazy>
                  }
                />
              </div>
            </div>
          </div>
        ) : market === "crypto" ? (
          <div className="space-y-5">
            <CryptoMarketChart ref={cryptoChartRef} coins={data.quotes} />
            <ViewportLazy minHeight={360} fallback={<BoardSkeleton />}>
              <GlobalMarketBoard
                data={data}
                accent={theme.accent}
                sectionTitle="Coins"
                sectionDescription={data.sourceLabel}
                hideSummaryStats
                hideCountry
                hideType
                useTableOnMobile={false}
                rowNoun="coin"
                prioritySymbols={["BTC","ETH","USDT","XRP","BNB","SOL","USDC","DOGE","ADA","TRX","HYPE","SUI","LINK","AVAX","XLM","TON","SHIB","HBAR","LTC","DOT"]}
              />
            </ViewportLazy>
          </div>
        ) : market === "us" ? (
          <div className="space-y-5">
            <UsMarketChart ref={usChartRef} quotes={data.quotes} />
            <ViewportLazy minHeight={360} fallback={<BoardSkeleton />}>
              <GlobalMarketBoard
                data={data}
                accent={theme.accent}
                sectionTitle="Markets & stocks"
                sectionDescription={data.sourceLabel}
                hideCountry
                useTableOnMobile={false}
                rowNoun="market"
                prioritySymbols={["^GSPC","^DJI","^NDX","^VIX","SPY","IVV","VOO","AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","BRK-B","JPM"]}
              />
            </ViewportLazy>
          </div>
        ) : (
        <GlobalMarketBoard
          data={data}
          showMap={market === "world"}
          accent={theme.accent}
          hideSummaryStats={market === "world"}
          sectionTitle={market === "world" ? "Daily exchange board" : "Markets"}
          sectionDescription={
            market === "world"
              ? `All country exchanges ranked by today's move. ${data.sourceLabel}`
              : undefined
          }
          useTableOnMobile={false}
          rowNoun={market === "world" ? "exchange" : "market"}
        />
        )
      ) : isLoading ? (
        <PageLoadingState message={`Loading ${title}...`} variant="global-market" />
      ) : (
        <EmptyState
          title={`${title} unavailable`}
          description={
            error?.message ??
            "The saved cache is empty and fresh market data could not be loaded. Please try again shortly."
          }
        />
      )}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/40 p-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-64 max-w-full" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function latestUpdatedAt(data: GlobalMarketData | null) {
  return data?.quotes
    .map((quote) => quote.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}
