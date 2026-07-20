"use client";

import {
  Bitcoin,
  Droplets,
  Gem,
  Globe2,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { GlobalMarketBoard } from "@/components/market/global-market-board";
import { PageHeader } from "@/components/page-header";
import { DataDelayBadge } from "@/components/status-badges";
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
            market === "commodities" ? ["GC=F","SI=F","HG=F","CL=F","BZ=F","PL=F","PA=F","NG=F","ZC=F","ZW=F","ZS=F","KC=F","CT=F","SB=F"] :
            market === "oil" ? ["CL=F","BZ=F","NG=F","RB=F","HO=F"] :
            market === "crypto" ? ["BTC","ETH","USDT","XRP","BNB","SOL","USDC","DOGE","ADA","TRX","HYPE","SUI","LINK","AVAX","XLM","TON","SHIB","HBAR","LTC","DOT"] :
            undefined
          }
        />
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
