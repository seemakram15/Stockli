import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { getFundsBreakdownData } from "@/lib/services/funds-breakdown";
import { identifyAmcBrand } from "@/lib/amc-brands";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

export interface TopHoldingFund {
  fundName: string;
  amc: string;
  amcShort: string;
  amcColor: string;
  percentage: number;
}

export interface MFTopHolding {
  symbol: string;
  stockName: string;
  fundCount: number;
  amcCount: number;
  totalWeight: number;
  avgWeight: number;
  changePct: number | null;
  funds: TopHoldingFund[];
}

export interface MFTopHoldingsData {
  holdings: MFTopHolding[];
  totalFunds: number;
  periodYear: number;
  periodMonth: number;
  updatedAt: string;
}

function emptyMFTopHoldingsData(): MFTopHoldingsData {
  return {
    holdings: [],
    totalFunds: 0,
    periodYear: 0,
    periodMonth: 0,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchProductionMFTopHoldings(): Promise<MFTopHoldingsData | null> {
  return fetchProductionPublicData<MFTopHoldingsData>({
    path: "/api/public/mf-top-holdings",
    refererPath: "/market/mf-top-holdings",
    isUsable: (data) => Boolean(data?.holdings?.length),
    label: "mf-top-holdings",
  });
}

export async function getMFTopHoldingsData(): Promise<MFTopHoldingsData> {
  try {
    const { value } = await getStaleCached({
      // v2: never cache empty boards; demo falls back to production when local data is empty.
      key: "market:mf-top-holdings-v2",
      ttlSeconds: 15 * 60,
      staleSeconds: 6 * 60 * 60,
      load: loadMFTopHoldingsData,
      isUsable: (data) => data.holdings.length > 0,
    });
    return value;
  } catch (error) {
    console.warn("[mf-top-holdings] unavailable:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionMFTopHoldings();
      if (remote?.holdings.length) return remote;
    }
    return emptyMFTopHoldingsData();
  }
}

async function loadMFTopHoldingsData(): Promise<MFTopHoldingsData> {
  const breakdown = await getFundsBreakdownData();

  if (!breakdown.funds.length) {
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionMFTopHoldings();
      if (remote?.holdings.length) return remote;
    }
    throw new Error("No funds breakdown available for top holdings");
  }

  type HoldingAgg = {
    symbol: string;
    stockName: string;
    changePct: number | null;
    amcs: Set<string>;
    funds: TopHoldingFund[];
    totalWeight: number;
  };
  const map = new Map<string, HoldingAgg>();

  for (const fund of breakdown.funds) {
    const brand = identifyAmcBrand(fund.amc);
    for (const holding of fund.holdings) {
      if (!holding.symbol || holding.stockName === "Other Holdings") continue;
      const key = holding.symbol.toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.amcs.add(fund.amc);
        existing.totalWeight += holding.percentage;
        existing.funds.push({
          fundName: fund.fundName,
          amc: fund.amc,
          amcShort: fund.amcShort,
          amcColor: brand.color,
          percentage: holding.percentage,
        });
        if (existing.changePct === null && holding.changePct !== null) {
          existing.changePct = holding.changePct;
        }
      } else {
        map.set(key, {
          symbol: key,
          stockName: holding.stockName,
          changePct: holding.changePct,
          amcs: new Set([fund.amc]),
          totalWeight: holding.percentage,
          funds: [
            {
              fundName: fund.fundName,
              amc: fund.amc,
              amcShort: fund.amcShort,
              amcColor: brand.color,
              percentage: holding.percentage,
            },
          ],
        });
      }
    }
  }

  const holdings: MFTopHolding[] = Array.from(map.values())
    .map((entry) => ({
      symbol: entry.symbol,
      stockName: entry.stockName,
      fundCount: entry.funds.length,
      amcCount: entry.amcs.size,
      totalWeight: entry.totalWeight,
      avgWeight: entry.totalWeight / entry.funds.length,
      changePct: entry.changePct,
      funds: entry.funds.sort((a, b) => b.percentage - a.percentage),
    }))
    .sort((a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight);

  if (!holdings.length) {
    throw new Error("No priced holdings derived from funds breakdown");
  }

  return {
    holdings,
    totalFunds: breakdown.funds.length,
    periodYear: breakdown.periodYear,
    periodMonth: breakdown.periodMonth,
    updatedAt: new Date().toISOString(),
  };
}
