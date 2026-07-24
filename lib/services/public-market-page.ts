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
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

export interface PublicMarketPageData {
  cards: IndexCard[];
  detail: IndexDetail | null;
  analytics: MarketAnalytics;
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

function isUsablePublicMarketPage(data: PublicMarketPageData): boolean {
  if (!data.detail || !data.cards.length) return false;
  const n = data.detail.candles?.length ?? 0;
  if (data.detail.symbol === "KSE100") return n >= 1400;
  return n > 300;
}

export async function getPublicMarketPageData(): Promise<PublicMarketPageData> {
  try {
    const cached = await getStaleCached({
      // v3: KSE100 includes Yahoo history back to 1997
      key: "public-page:psx-market:v3",
      ttlSeconds: psxLiveCacheTtlSeconds(),
      staleSeconds: shouldRefreshPsxData() ? 15 * 60 : psxLiveCacheTtlSeconds(),
      load: loadPublicMarketPageData,
      isUsable: isUsablePublicMarketPage,
    });

    return {
      ...cached.value,
      market: marketStatus(),
    };
  } catch (error) {
    console.warn("[public-market-page] unavailable:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionPublicData<PublicMarketPageData>({
        path: "/api/public/market",
        refererPath: "/market",
        isUsable: isUsablePublicMarketPage,
        label: "public-market",
      });
      if (remote) {
        return {
          ...remote,
          market: marketStatus(),
        };
      }
    }
    throw error;
  }
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
