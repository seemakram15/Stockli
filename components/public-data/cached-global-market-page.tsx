"use client";

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
import { GlobalMarketBoard } from "@/components/market/global-market-board";
import { PakistanFuelPricesBoard } from "@/components/market/pakistan-fuel-prices-board";
import { BrentCrudeChart } from "@/components/market/brent-crude-chart";
import { PakistanCommoditiesBoard } from "@/components/market/pakistan-commodities-board";
import { GlobalCommodityChart } from "@/components/market/global-commodity-chart";
import { PageHeader } from "@/components/page-header";
import { type Accent } from "@/components/ui/accent";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { GlobalMarketData, MarketUniverse } from "@/lib/services/global-markets";

const MARKET_THEME: Record<MarketUniverse, { accent: Accent; eyebrow: string; Icon: LucideIcon }> = {
  us: { accent: "sky", eyebrow: "USA markets", Icon: LineChart },
  india: { accent: "rose", eyebrow: "India markets", Icon: LineChart },
  world: { accent: "indigo", eyebrow: "World indices", Icon: Globe2 },
  commodities: { accent: "amber", eyebrow: "Commodities", Icon: Gem },
  oil: { accent: "orange", eyebrow: "Energy", Icon: Droplets },
  crypto: { accent: "violet", eyebrow: "Crypto", Icon: Bitcoin },
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
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<GlobalMarketData>({
      cacheKey: `public:global-market:${market}`,
      url: `/api/public/global-market/${market}`,
      refreshInterval: market === "crypto" ? 60_000 : 2 * 60_000,
    });

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
          </>
        }
      />

      {data ? (
        market === "commodities" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Pakistan Commodities */}
            <div className="min-w-0 overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-500/[0.04]">
              <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <Gem className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Pakistan Commodity Prices</p>
                  <p className="text-xs text-muted-foreground">Gold & silver — PKR per tola</p>
                </div>
              </div>
              <div className="p-4">
                <PakistanCommoditiesBoard />
              </div>
            </div>

            {/* Global Commodities */}
            <div className="min-w-0 overflow-hidden rounded-2xl border border-sky-500/25 bg-sky-500/[0.04]">
              <div className="flex items-center gap-3 border-b border-sky-500/20 bg-sky-500/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                  <Globe2 className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Global Commodities</p>
                  <p className="text-xs text-muted-foreground">Metals, agriculture & soft — Yahoo Finance</p>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <GlobalMarketBoard
                  data={data}
                  accent={theme.accent}
                  prioritySymbols={["GC=F","SI=F","HG=F","CL=F","BZ=F","PL=F","PA=F","NG=F","ZC=F","ZW=F","ZS=F","KC=F","CT=F","SB=F"]}
                  priceCardSymbols={["GC=F","SI=F","HG=F","PL=F"]}
                  hideSummaryStats
                  hideCountry
                  chartSlot={<GlobalCommodityChart />}
                />
              </div>
            </div>
          </div>
        ) : market === "oil" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Pakistan Fuel Prices */}
            <div className="min-w-0 overflow-hidden rounded-2xl border border-orange-500/25 bg-orange-500/[0.04]">
              <div className="flex items-center gap-3 border-b border-orange-500/20 bg-orange-500/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
                  <Flame className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Pakistan Fuel Prices</p>
                  <p className="text-xs text-muted-foreground">OGRA — revised bi-monthly</p>
                </div>
              </div>
              <div className="p-4">
                <PakistanFuelPricesBoard />
              </div>
            </div>

            {/* Global Oil Markets */}
            <div className="min-w-0 overflow-hidden rounded-2xl border border-sky-500/25 bg-sky-500/[0.04]">
              <div className="flex items-center gap-3 border-b border-sky-500/20 bg-sky-500/[0.06] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400">
                  <Droplets className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Global Oil Markets</p>
                  <p className="text-xs text-muted-foreground">Live futures — Yahoo Finance</p>
                </div>
              </div>
              <div className="p-4">
                <GlobalMarketBoard
                  data={data}
                  accent={theme.accent}
                  prioritySymbols={["CL=F","BZ=F","NG=F","RB=F","HO=F"]}
                  priceCardSymbols={["CL=F","BZ=F","NG=F","RB=F"]}
                  hideSummaryStats
                  hideCountry
                  chartSlot={<BrentCrudeChart />}
                />
              </div>
            </div>
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
          prioritySymbols={
            market === "crypto" ? ["BTC","ETH","USDT","XRP","BNB","SOL","USDC","DOGE","ADA","TRX","HYPE","SUI","LINK","AVAX","XLM","TON","SHIB","HBAR","LTC","DOT"] :
            undefined
          }
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

function latestUpdatedAt(data: GlobalMarketData | null) {
  return data?.quotes
    .map((quote) => quote.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
}
