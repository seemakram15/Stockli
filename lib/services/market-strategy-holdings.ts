import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { getMufapFunds } from "@/lib/services/mufap";
import { getLatestPublishedHoldingsAll } from "@/lib/services/fund-holdings";
import { getAllQuotes } from "@/lib/services/prices";
import { identifyAmcBrand, shortAmcName } from "@/lib/amc-brands";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  FUND_INVESTMENT_AMOUNT,
  computeFundReturnEstimate,
} from "@/lib/services/fund-return-estimate";
import type { FundClassFilter } from "@/lib/services/mufap";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

export interface HoldingsStrategyFund {
  fundName: string;
  amc: string;
  fundId: string | null;
  amcShort: string;
  amcLogoUrl: string | null;
  classFilter: FundClassFilter;
  /** Official NAV 1-day return% from MUFAP (may be null if no match or no data). */
  navReturnPct: number | null;
  /** Holdings-weighted return%, averaged over priced holdings only. */
  holdingsReturnPct: number | null;
  /** Rs per 100k invested based on holdings return. */
  estimatedReturn: number | null;
  periodYear: number;
  periodMonth: number;
  /** Number of stocks with PSX symbols used in the estimate. */
  pricedHoldings: number;
  totalHoldings: number;
  /** Weight% of the catch-all "Other Holdings" row (undisclosed allocations, excluded from the estimate). */
  unknownWeight: number;
}

export interface HoldingsStrategyData {
  funds: HoldingsStrategyFund[];
  periodYear: number;
  periodMonth: number;
  updatedAt: string;
  investmentAmount: number;
  summary: {
    totalFunds: number;
    positiveCount: number;
    negativeCount: number;
    avgEstimatedReturn: number;
    best: HoldingsStrategyFund | null;
    worst: HoldingsStrategyFund | null;
  };
}

function emptyHoldingsStrategyData(): HoldingsStrategyData {
  return {
    funds: [],
    periodYear: 0,
    periodMonth: 0,
    updatedAt: new Date().toISOString(),
    investmentAmount: FUND_INVESTMENT_AMOUNT,
    summary: {
      totalFunds: 0,
      positiveCount: 0,
      negativeCount: 0,
      avgEstimatedReturn: 0,
      best: null,
      worst: null,
    },
  };
}

async function fetchProductionHoldingsStrategy(): Promise<HoldingsStrategyData | null> {
  return fetchProductionPublicData<HoldingsStrategyData>({
    path: "/api/public/market-strategy-holdings",
    refererPath: "/market/strategy",
    isUsable: (data) => Boolean(data?.funds?.length),
    label: "market-strategy-holdings",
  });
}

export async function getHoldingsStrategyData(): Promise<HoldingsStrategyData> {
  try {
    const { value } = await getStaleCached({
      // v2: never cache empty boards; demo falls back to production when local DB is empty.
      key: "market-strategy:holdings-v2",
      ttlSeconds: shouldRefreshPsxData() ? 5 * 60 : psxLiveCacheTtlSeconds(),
      staleSeconds: shouldRefreshPsxData() ? 6 * 60 * 60 : psxLiveCacheTtlSeconds(),
      load: loadHoldingsStrategyData,
      isUsable: (data) => data.funds.length > 0,
    });
    return value;
  } catch (error) {
    console.warn("[market-strategy-holdings] unavailable:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionHoldingsStrategy();
      if (remote?.funds.length) return remote;
    }
    return emptyHoldingsStrategyData();
  }
}

async function loadHoldingsStrategyData(): Promise<HoldingsStrategyData> {
  const [holdingsData, fundsData, allQuotes] = await Promise.all([
    getLatestPublishedHoldingsAll().catch((error) => {
      console.warn("[market-strategy-holdings] holdings load failed:", error);
      return {
        year: 0,
        month: 0,
        funds: [] as Awaited<ReturnType<typeof getLatestPublishedHoldingsAll>>["funds"],
      };
    }),
    getMufapFunds().catch(() => null),
    getAllQuotes().catch(() => [] as Awaited<ReturnType<typeof getAllQuotes>>),
  ]);

  const { year, month, funds: holdingsFunds } = holdingsData;

  if (!holdingsFunds.length) {
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionHoldingsStrategy();
      if (remote?.funds.length) return remote;
    }
    throw new Error("No published fund holdings available for strategy");
  }

  // Build a quote map for O(1) symbol lookup
  const quoteMap = new Map(allQuotes.map((q) => [q.symbol.toUpperCase(), q]));

  // Build MUFAP lookup by normalized fund name
  type MufapFundEntry = NonNullable<typeof fundsData>["funds"][0];
  const mufapByName = new Map<string, MufapFundEntry>();
  if (fundsData) {
    for (const f of fundsData.funds) {
      mufapByName.set(norm(f.name), f);
    }
  }

  const strategyFunds: HoldingsStrategyFund[] = holdingsFunds.map((hf) => {
    const mufap = mufapByName.get(norm(hf.fundName)) ?? null;
    const brand = identifyAmcBrand(hf.amc);

    const estimate = computeFundReturnEstimate(hf.holdings, quoteMap, FUND_INVESTMENT_AMOUNT);

    return {
      fundName: hf.fundName,
      amc: hf.amc,
      fundId: mufap?.fundId ?? null,
      amcShort: mufap?.amcShort || shortAmcName(hf.amc) || brand.shortName,
      amcLogoUrl: mufap?.amcLogoUrl ?? null,
      classFilter: mufap?.classFilter ?? "conventional",
      navReturnPct: mufap?.d1 ?? null,
      holdingsReturnPct: estimate.returnPct,
      estimatedReturn: estimate.estimatedReturn,
      periodYear: year,
      periodMonth: month,
      pricedHoldings: estimate.pricedHoldings,
      totalHoldings: hf.holdings.length,
      unknownWeight: estimate.unknownWeight,
    };
  });

  strategyFunds.sort(
    (a, b) => a.amc.localeCompare(b.amc) || a.fundName.localeCompare(b.fundName)
  );

  const priced = strategyFunds.filter((f) => f.estimatedReturn != null);
  const ranked = [...priced].sort(
    (a, b) => (b.estimatedReturn ?? 0) - (a.estimatedReturn ?? 0)
  );
  const totalEstimated = priced.reduce((s, f) => s + (f.estimatedReturn ?? 0), 0);

  return {
    funds: strategyFunds,
    periodYear: year,
    periodMonth: month,
    updatedAt: new Date().toISOString(),
    investmentAmount: FUND_INVESTMENT_AMOUNT,
    summary: {
      totalFunds: strategyFunds.length,
      positiveCount: priced.filter((f) => (f.estimatedReturn ?? 0) > 0).length,
      negativeCount: priced.filter((f) => (f.estimatedReturn ?? 0) < 0).length,
      avgEstimatedReturn: priced.length ? totalEstimated / priced.length : 0,
      best: ranked[0] ?? null,
      worst: ranked[ranked.length - 1] ?? null,
    },
  };
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
