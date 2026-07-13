import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import {
  getPublishedPeriods,
  getPublishedFundHoldings,
  getLatestPublishedPeriod,
  getPublishedHoldingsForPeriod,
} from "@/lib/services/fund-holdings";
import { getAllQuotes } from "@/lib/services/prices";
import { identifyAmcBrand, shortAmcName } from "@/lib/amc-brands";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";

const INVESTMENT_AMOUNT = 100_000;

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

export async function getFundHoldingsReturn(fundName: string): Promise<FundHoldingsReturn> {
  const { value } = await getStaleCached({
    key: `fund-return:${fundName}`,
    ttlSeconds: shouldRefreshPsxData() ? 5 * 60 : psxLiveCacheTtlSeconds(),
    staleSeconds: shouldRefreshPsxData() ? 6 * 60 * 60 : psxLiveCacheTtlSeconds(),
    load: () => loadFundHoldingsReturn(fundName),
    isUsable: () => true,
  });
  return value;
}

async function loadFundHoldingsReturn(fundName: string): Promise<FundHoldingsReturn> {
  const periods = await getPublishedPeriods(fundName);
  const period = periods[0];
  if (!period) {
    return {
      returnPct: null,
      estimateOn100k: null,
      pricedHoldings: 0,
      totalHoldings: 0,
      periodYear: 0,
      periodMonth: 0,
    };
  }

  const [holdings, allQuotes] = await Promise.all([
    getPublishedFundHoldings(fundName, period.year, period.month),
    getAllQuotes().catch(() => [] as Awaited<ReturnType<typeof getAllQuotes>>),
  ]);

  const quoteMap = new Map(allQuotes.map((q) => [q.symbol.toUpperCase(), q]));
  const symbolHoldings = holdings.filter(
    (h) => h.symbol && h.stockName !== "Other Holdings"
  );

  let weightedReturnSum = 0;
  let totalWeight = 0;
  let pricedHoldings = 0;
  for (const h of symbolHoldings) {
    const quote = quoteMap.get(h.symbol!.toUpperCase());
    if (quote != null) {
      weightedReturnSum += h.percentage * quote.changePct;
      totalWeight += h.percentage;
      pricedHoldings++;
    }
  }

  const returnPct =
    pricedHoldings > 0 && totalWeight > 0 ? weightedReturnSum / totalWeight : null;

  return {
    returnPct,
    estimateOn100k: returnPct != null ? (returnPct / 100) * INVESTMENT_AMOUNT : null,
    pricedHoldings,
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
}

export interface FundsHoldingStockData {
  symbol: string;
  funds: FundHoldingStock[];
  periodYear: number;
  periodMonth: number;
}

export async function getFundsHoldingStock(symbol: string): Promise<FundsHoldingStockData> {
  const normalized = symbol.toUpperCase();
  const { value } = await getStaleCached({
    key: `stock-funds:${normalized}`,
    ttlSeconds: 30 * 60,
    staleSeconds: 24 * 60 * 60,
    load: () => loadFundsHoldingStock(normalized),
    isUsable: () => true,
  });
  return value;
}

async function loadFundsHoldingStock(symbol: string): Promise<FundsHoldingStockData> {
  const period = await getLatestPublishedPeriod();
  if (!period) {
    return { symbol, funds: [], periodYear: 0, periodMonth: 0 };
  }

  const fundGroups = await getPublishedHoldingsForPeriod(period.year, period.month);
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
