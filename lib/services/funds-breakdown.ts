import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { getMufapFunds } from "@/lib/services/mufap";
import { getLatestPublishedHoldingsAll } from "@/lib/services/fund-holdings";
import { getAllQuotes } from "@/lib/services/prices";
import { identifyAmcBrand, shortAmcName } from "@/lib/amc-brands";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";

const INVESTMENT_AMOUNT = 100_000;

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
  /** Weight% of the catch-all "Other Holdings" row. */
  unknownWeight: number;
  /** Sum of weight% of holdings for which we got a live PSX price. */
  pricedWeight: number;
  /** Rs P/L on 100k from priced holdings only. */
  pricedEstimate: number | null;
  /** Rs P/L estimate for the unknown% (proxy: weighted avg change of priced holdings). */
  unknownEstimate: number | null;
  /** Total Rs P/L on 100k (priced + unknown proxy). */
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

export async function getFundsBreakdownData(): Promise<FundsBreakdownData> {
  const { value } = await getStaleCached({
    key: "market:funds-breakdown-v1",
    ttlSeconds: shouldRefreshPsxData() ? 5 * 60 : psxLiveCacheTtlSeconds(),
    staleSeconds: shouldRefreshPsxData() ? 6 * 60 * 60 : psxLiveCacheTtlSeconds(),
    load: loadFundsBreakdownData,
    isUsable: (data) => data.funds.length > 0,
  });
  return value;
}

async function loadFundsBreakdownData(): Promise<FundsBreakdownData> {
  const [holdingsData, fundsData, allQuotes] = await Promise.all([
    getLatestPublishedHoldingsAll(),
    getMufapFunds().catch(() => null),
    getAllQuotes().catch(() => [] as Awaited<ReturnType<typeof getAllQuotes>>),
  ]);

  const { year, month, funds: holdingsFunds } = holdingsData;

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

    // Extract equity allocation % from MUFAP asset allocation
    const equityPct =
      mufap?.assetAllocation.find(
        (a) => a.label.toLowerCase().includes("equity") || a.label.toLowerCase().includes("stock")
      )?.percent ?? null;

    let knownWeight = 0;
    let unknownWeight = 0;
    let pricedWeightedReturnSum = 0;
    let pricedWeight = 0;
    let pricedEstimate = 0;

    const holdings: BreakdownHolding[] = hf.holdings.map((h) => {
      const isOther = h.stockName === "Other Holdings" || !h.symbol;

      if (isOther) {
        if (h.stockName === "Other Holdings") unknownWeight += h.percentage;
        return { symbol: h.symbol, stockName: h.stockName, percentage: h.percentage, changePct: null, plAmount: null };
      }

      knownWeight += h.percentage;
      const quote = quoteMap.get(h.symbol!.toUpperCase()) ?? null;
      if (quote != null) {
        const changePct = quote.changePct;
        const pl = (h.percentage / 100) * (changePct / 100) * INVESTMENT_AMOUNT;
        pricedWeightedReturnSum += h.percentage * changePct;
        pricedWeight += h.percentage;
        pricedEstimate += pl;
        return { symbol: h.symbol, stockName: h.stockName, percentage: h.percentage, changePct, plAmount: pl };
      }
      return { symbol: h.symbol, stockName: h.stockName, percentage: h.percentage, changePct: null, plAmount: null };
    });

    // Proxy for unknown holdings: assume same avg changePct as priced holdings
    let unknownEstimate: number | null = null;
    if (unknownWeight > 0 && pricedWeight > 0) {
      const avgChangePct = pricedWeightedReturnSum / pricedWeight;
      unknownEstimate = (unknownWeight / 100) * (avgChangePct / 100) * INVESTMENT_AMOUNT;
    }

    const hasPriced = pricedWeight > 0;
    const totalEstimate = hasPriced
      ? pricedEstimate + (unknownEstimate ?? 0)
      : null;

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
      unknownWeight,
      pricedWeight,
      pricedEstimate: hasPriced ? pricedEstimate : null,
      unknownEstimate,
      totalEstimate,
      periodYear: year,
      periodMonth: month,
    };
  });

  // Sort: AMC alphabetical, then fund name
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
