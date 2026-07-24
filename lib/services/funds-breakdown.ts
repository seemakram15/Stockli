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
  profitOnInvestment,
} from "@/lib/services/fund-return-estimate";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

export interface BreakdownHolding {
  symbol: string | null;
  stockName: string;
  percentage: number;
  changePct: number | null;
  plAmount: number | null; // (percentage/100) × (changePct/100) × INVESTMENT_AMOUNT
}

export interface BreakdownFund {
  fundName: string;
  amc: string;
  amcShort: string;
  amcLogoUrl: string | null;
  fundId: string | null;
  classFilter: string;
  equityPct: number | null;
  holdings: BreakdownHolding[];
  /** Sum of weight% of holdings that have a PSX symbol (excl. "Other Holdings"). */
  knownWeight: number;
  /** Weight% of the catch-all "Other Holdings" row (undisclosed allocations, excluded from the estimate). */
  unknownWeight: number;
  /** Sum of weight% of holdings for which we got a live PSX price — what totalEstimate is based on. */
  pricedWeight: number;
  /** Fund-level weighted-average return %, over priced holdings only. */
  returnPct: number | null;
  /** Rs P/L on 100k based on returnPct. Same figure shown on /market/strategy for this fund. */
  totalEstimate: number | null;
  periodYear: number;
  periodMonth: number;
}

export interface FundsBreakdownData {
  funds: BreakdownFund[];
  periodYear: number;
  periodMonth: number;
  updatedAt: string;
}

function emptyBreakdownData(): FundsBreakdownData {
  return {
    funds: [],
    periodYear: 0,
    periodMonth: 0,
    updatedAt: new Date().toISOString(),
  };
}

export async function getFundsBreakdownData(): Promise<FundsBreakdownData> {
  try {
    const { value } = await getStaleCached({
      key: "market:funds-breakdown-v2",
      ttlSeconds: shouldRefreshPsxData() ? 5 * 60 : psxLiveCacheTtlSeconds(),
      staleSeconds: shouldRefreshPsxData() ? 6 * 60 * 60 : psxLiveCacheTtlSeconds(),
      load: loadFundsBreakdownData,
      // Never cache an empty board — that poisons Redis after a demo/no-DB miss.
      isUsable: (data) => data.funds.length > 0,
    });
    return value;
  } catch (error) {
    console.warn("[funds-breakdown] unavailable:", error);
    // Last resort for local demo without Supabase: production public snapshot.
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionFundsBreakdown();
      if (remote?.funds.length) return remote;
    }
    return emptyBreakdownData();
  }
}

async function fetchProductionFundsBreakdown(): Promise<FundsBreakdownData | null> {
  return fetchProductionPublicData<FundsBreakdownData>({
    path: "/api/public/funds-breakdown",
    refererPath: "/market/funds-breakdown",
    isUsable: (data) => Boolean(data?.funds?.length),
    label: "funds-breakdown",
  });
}

async function loadFundsBreakdownData(): Promise<FundsBreakdownData> {
  const [holdingsData, fundsData, allQuotes] = await Promise.all([
    getLatestPublishedHoldingsAll().catch((error) => {
      console.warn("[funds-breakdown] holdings load failed:", error);
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

  // Local demo / missing service-role: don't write an empty payload into cache.
  if (!holdingsFunds.length) {
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionFundsBreakdown();
      if (remote?.funds.length) return remote;
    }
    throw new Error("No published fund holdings available");
  }

  const quoteMap = new Map(allQuotes.map((q) => [q.symbol.toUpperCase(), q]));

  type MufapEntry = NonNullable<typeof fundsData>["funds"][0];
  const mufapByName = new Map<string, MufapEntry>();
  if (fundsData) {
    for (const f of fundsData.funds) {
      mufapByName.set(norm(f.name), f);
    }
  }

  const breakdownFunds: BreakdownFund[] = holdingsFunds.map((hf) => {
    const mufap = mufapByName.get(norm(hf.fundName)) ?? null;
    const brand = identifyAmcBrand(hf.amc);

    const equityPct =
      mufap?.assetAllocation.find(
        (a) => a.label.toLowerCase().includes("equity") || a.label.toLowerCase().includes("stock")
      )?.percent ?? null;

    let knownWeight = 0;

    const holdings: BreakdownHolding[] = hf.holdings.map((h) => {
      const isOther = h.stockName === "Other Holdings" || !h.symbol;
      if (isOther) {
        return {
          symbol: h.symbol,
          stockName: h.stockName,
          percentage: h.percentage,
          changePct: null,
          plAmount: null,
        };
      }

      knownWeight += h.percentage;
      const quote = quoteMap.get(h.symbol!.toUpperCase()) ?? null;
      if (quote != null && Number.isFinite(quote.changePct)) {
        const changePct = quote.changePct;
        const pl = profitOnInvestment(changePct, (h.percentage / 100) * FUND_INVESTMENT_AMOUNT);
        return {
          symbol: h.symbol,
          stockName: h.stockName,
          percentage: h.percentage,
          changePct,
          plAmount: pl,
        };
      }
      return {
        symbol: h.symbol,
        stockName: h.stockName,
        percentage: h.percentage,
        changePct: null,
        plAmount: null,
      };
    });

    const estimate = computeFundReturnEstimate(hf.holdings, quoteMap, FUND_INVESTMENT_AMOUNT);

    return {
      fundName: hf.fundName,
      amc: hf.amc,
      amcShort: mufap?.amcShort || shortAmcName(hf.amc) || brand.shortName,
      amcLogoUrl: mufap?.amcLogoUrl ?? null,
      fundId: mufap?.fundId ?? null,
      classFilter: mufap?.classFilter ?? "conventional",
      equityPct,
      holdings,
      knownWeight,
      unknownWeight: estimate.unknownWeight,
      pricedWeight: estimate.pricedWeight,
      returnPct: estimate.returnPct,
      totalEstimate: estimate.estimatedReturn,
      periodYear: year,
      periodMonth: month,
    };
  });

  breakdownFunds.sort(
    (a, b) => a.amc.localeCompare(b.amc) || a.fundName.localeCompare(b.fundName)
  );

  return {
    funds: breakdownFunds,
    periodYear: year,
    periodMonth: month,
    updatedAt: new Date().toISOString(),
  };
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
