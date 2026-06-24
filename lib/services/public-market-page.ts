import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { marketStatus, psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  getIndexCards,
  getIndexDetail,
  getMarketAnalytics,
  type IndexCard,
  type IndexDetail,
  type MarketAnalytics,
} from "@/lib/services/market";

export interface PublicMarketPageData {
  cards: IndexCard[];
  detail: IndexDetail | null;
  analytics: MarketAnalytics;
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

export async function getPublicMarketPageData(): Promise<PublicMarketPageData> {
  const cached = await getStaleCached({
    key: "public-page:psx-market",
    ttlSeconds: psxLiveCacheTtlSeconds(),
    staleSeconds: shouldRefreshPsxData() ? 15 * 60 : psxLiveCacheTtlSeconds(),
    load: loadPublicMarketPageData,
    isUsable: (data) => Boolean(data.detail && data.cards.length),
  });

  return {
    ...cached.value,
    market: marketStatus(),
  };
}

async function loadPublicMarketPageData(): Promise<PublicMarketPageData> {
  const [cards, detail, analytics] = await Promise.all([
    getIndexCards(),
    getIndexDetail("KSE100"),
    getMarketAnalytics(),
  ]);

  return {
    cards,
    detail,
    analytics,
    market: marketStatus(),
    updatedAt: new Date().toISOString(),
  };
}
