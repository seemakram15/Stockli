import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { getMufapFunds } from "@/lib/services/mufap";
import { getLatestPublishedHoldingsAll } from "@/lib/services/fund-holdings";
import { getAllQuotes } from "@/lib/services/prices";
import { identifyAmcBrand, shortAmcName } from "@/lib/amc-brands";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import type { FundClassFilter } from "@/lib/services/mufap";

const INVESTMENT_AMOUNT = 100_000;

export interface HoldingsStrategyFund {
  fundName: string;
  amc: string;
  fundId: string | null;
  amcShort: string;
  amcLogoUrl: string | null;
  classFilter: FundClassFilter;
  /** Official NAV 1-day return% from MUFAP (may be null if no match or no data). */
  navReturnPct: number | null;
  /** Holdings-weighted return%: Σ(holding% × stockChangePct) / 100. */
  holdingsReturnPct: number | null;
  /** Rs per 100k invested based on holdings return. */
  estimatedReturn: number | null;
  periodYear: number;
  periodMonth: number;
  /** Number of stocks with PSX symbols used in the estimate. */
  pricedHoldings: number;
  totalHoldings: number;
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

export async function getHoldingsStrategyData(): Promise<HoldingsStrategyData> {
  const { value } = await getStaleCached({
    key: "market-strategy:holdings-v1",
    ttlSeconds: shouldRefreshPsxData() ? 5 * 60 : psxLiveCacheTtlSeconds(),
    staleSeconds: shouldRefreshPsxData() ? 6 * 60 * 60 : psxLiveCacheTtlSeconds(),
    load: loadHoldingsStrategyData,
    isUsable: (data) => data.funds.length > 0,
  });
  return value;
}

async function loadHoldingsStrategyData(): Promise<HoldingsStrategyData> {
  const [holdingsData, fundsData, allQuotes] = await Promise.all([
    getLatestPublishedHoldingsAll(),
    getMufapFunds().catch(() => null),
    getAllQuotes().catch(() => [] as Awaited<ReturnType<typeof getAllQuotes>>),
  ]);

  const { year, month, funds: holdingsFunds } = holdingsData;

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

    // Only count stocks with symbols (skip "Other Holdings" catch-all row)
    const symbolHoldings = hf.holdings.filter(
      (h) => h.symbol && h.stockName !== "Other Holdings"
    );

    let holdingsReturnPct: number | null = null;
    let pricedHoldings = 0;

    if (symbolHoldings.length > 0) {
      let weightedReturnSum = 0; // Σ(holding% × changePct)
      let totalWeight = 0;       // Σ(holding%)
      for (const h of symbolHoldings) {
        const quote = quoteMap.get(h.symbol!.toUpperCase());
        if (quote != null) {
          weightedReturnSum += h.percentage * quote.changePct;
          totalWeight += h.percentage;
          pricedHoldings++;
        }
      }
      // Weighted average: Σ(w × r) / Σ(w) — independent of coverage %
      if (pricedHoldings > 0 && totalWeight > 0) {
        holdingsReturnPct = weightedReturnSum / totalWeight;
      }
    }

    const estimatedReturn =
      holdingsReturnPct != null
        ? (holdingsReturnPct / 100) * INVESTMENT_AMOUNT
        : null;

    return {
      fundName: hf.fundName,
      amc: hf.amc,
      fundId: mufap?.fundId ?? null,
      amcShort: mufap?.amcShort || shortAmcName(hf.amc) || brand.shortName,
      amcLogoUrl: mufap?.amcLogoUrl ?? null,
      classFilter: mufap?.classFilter ?? "conventional",
      navReturnPct: mufap?.d1 ?? null,
      holdingsReturnPct,
      estimatedReturn,
      periodYear: year,
      periodMonth: month,
      pricedHoldings,
      totalHoldings: symbolHoldings.length,
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
    investmentAmount: INVESTMENT_AMOUNT,
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
