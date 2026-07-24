import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import {
  getPublishedPeriods,
  getPublishedFundHoldings,
  getLatestPublishedPeriod,
  getPublishedHoldingsForPeriod,
} from "@/lib/services/fund-holdings";
import { getAllQuotes } from "@/lib/services/prices";
import { getMufapFunds, type FundClassFilter } from "@/lib/services/mufap";
import { identifyAmcBrand, shortAmcName } from "@/lib/amc-brands";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  FUND_INVESTMENT_AMOUNT,
  computeFundReturnEstimate,
} from "@/lib/services/fund-return-estimate";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

export interface FundHoldingsReturn {
  /** Holdings-weighted 1-day return%: Σ(weight × changePct) / Σ(weight). */
  returnPct: number | null;
  /** Rs P/L on 100k invested, based on the weighted return. */
  estimateOn100k: number | null;
  pricedHoldings: number;
  totalHoldings: number;
  periodYear: number;
  periodMonth: number;
}

const EMPTY_HOLDINGS_RETURN: FundHoldingsReturn = {
  returnPct: null,
  estimateOn100k: null,
  pricedHoldings: 0,
  totalHoldings: 0,
  periodYear: 0,
  periodMonth: 0,
};

export async function getFundHoldingsReturn(fundName: string): Promise<FundHoldingsReturn> {
  try {
    const { value } = await getStaleCached({
      key: `fund-return-v2:${fundName}`,
      ttlSeconds: shouldRefreshPsxData() ? 5 * 60 : psxLiveCacheTtlSeconds(),
      staleSeconds: shouldRefreshPsxData() ? 6 * 60 * 60 : psxLiveCacheTtlSeconds(),
      load: () => loadFundHoldingsReturn(fundName),
      // Cache only once a published period resolved (demo may use production holdings).
      isUsable: (data) => data.periodYear > 0,
    });
    return value;
  } catch (error) {
    console.warn("[fund-returns] getFundHoldingsReturn failed:", error);
    return EMPTY_HOLDINGS_RETURN;
  }
}

async function loadFundHoldingsReturn(fundName: string): Promise<FundHoldingsReturn> {
  const periods = await getPublishedPeriods(fundName);
  const period = periods[0];
  if (!period) {
    throw new Error(`No published holdings period for ${fundName}`);
  }

  const [holdings, allQuotes] = await Promise.all([
    getPublishedFundHoldings(fundName, period.year, period.month),
    getAllQuotes().catch(() => [] as Awaited<ReturnType<typeof getAllQuotes>>),
  ]);

  const quoteMap = new Map(allQuotes.map((q) => [q.symbol.toUpperCase(), q]));
  // Shared formula with funds-breakdown + daily returns report.
  const estimate = computeFundReturnEstimate(holdings, quoteMap, FUND_INVESTMENT_AMOUNT);
  const symbolHoldings = holdings.filter(
    (h) => h.symbol && h.stockName !== "Other Holdings"
  );

  return {
    returnPct: estimate.returnPct,
    estimateOn100k: estimate.estimatedReturn,
    pricedHoldings: estimate.pricedHoldings,
    totalHoldings: symbolHoldings.length,
    periodYear: period.year,
    periodMonth: period.month,
  };
}

export interface FundHoldingStock {
  fundName: string;
  amc: string;
  amcShort: string;
  percentage: number;
  rank: number | null;
  /** MUFAP Shariah / Islamic classification when available. */
  classFilter: FundClassFilter;
}

export interface FundsHoldingStockData {
  symbol: string;
  funds: FundHoldingStock[];
  periodYear: number;
  periodMonth: number;
}

async function fetchProductionStockFunds(
  symbol: string
): Promise<FundsHoldingStockData | null> {
  return fetchProductionPublicData<FundsHoldingStockData>({
    path: `/api/public/stock-funds/${encodeURIComponent(symbol)}`,
    refererPath: `/stock/${encodeURIComponent(symbol)}`,
    // periodYear > 0 means production resolved published holdings even if this
    // symbol happens to have zero fund holders.
    isUsable: (data) => Boolean(data && data.periodYear > 0),
    label: "fund-returns",
  });
}

export async function getFundsHoldingStock(symbol: string): Promise<FundsHoldingStockData> {
  const normalized = symbol.toUpperCase();
  try {
    const { value } = await getStaleCached({
      // v3: demo/no-DB resolves via production public stock-funds snapshot.
      key: `stock-funds-v3:${normalized}`,
      ttlSeconds: 30 * 60,
      staleSeconds: 24 * 60 * 60,
      load: () => loadFundsHoldingStock(normalized),
      isUsable: (data) => data.periodYear > 0,
    });
    return value;
  } catch (error) {
    console.warn("[fund-returns] getFundsHoldingStock failed:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionStockFunds(normalized);
      if (remote) return remote;
    }
    return { symbol: normalized, funds: [], periodYear: 0, periodMonth: 0 };
  }
}

async function loadFundsHoldingStock(symbol: string): Promise<FundsHoldingStockData> {
  const period = await getLatestPublishedPeriod();
  if (!period) {
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionStockFunds(symbol);
      if (remote) return remote;
    }
    throw new Error("No published holdings period available");
  }

  const [fundGroups, mufapData] = await Promise.all([
    getPublishedHoldingsForPeriod(period.year, period.month),
    getMufapFunds().catch(() => null),
  ]);

  if (!fundGroups.length) {
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionStockFunds(symbol);
      if (remote) return remote;
    }
    throw new Error("No published holdings groups available");
  }

  const mufapByName = new Map<string, FundClassFilter>();
  if (mufapData) {
    for (const f of mufapData.funds) {
      mufapByName.set(normFundName(f.name), f.classFilter);
    }
  }

  const funds: FundHoldingStock[] = [];

  for (const group of fundGroups) {
    const match = group.holdings.find((h) => h.symbol?.toUpperCase() === symbol);
    if (match) {
      const brand = identifyAmcBrand(group.amc);
      funds.push({
        fundName: group.fundName,
        amc: group.amc,
        amcShort: shortAmcName(group.amc) || brand.shortName,
        percentage: match.percentage,
        rank: match.rank,
        classFilter: mufapByName.get(normFundName(group.fundName)) ?? "conventional",
      });
    }
  }

  funds.sort((a, b) => b.percentage - a.percentage);

  return {
    symbol,
    funds,
    periodYear: period.year,
    periodMonth: period.month,
  };
}

function normFundName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
