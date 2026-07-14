import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { getFundsBreakdownData } from "@/lib/services/funds-breakdown";
import { identifyAmcBrand } from "@/lib/amc-brands";

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

export async function getMFTopHoldingsData(): Promise<MFTopHoldingsData> {
  const { value } = await getStaleCached({
    key: "market:mf-top-holdings-v1",
    ttlSeconds: 15 * 60,
    staleSeconds: 6 * 60 * 60,
    load: loadMFTopHoldingsData,
    isUsable: (data) => data.holdings.length > 0,
  });
  return value;
}

async function loadMFTopHoldingsData(): Promise<MFTopHoldingsData> {
  const breakdown = await getFundsBreakdownData();

  const map = new Map<
    string,
    {
      symbol: string;
      stockName: string;
      changePct: number | null;
      amcs: Set<string>;
      funds: TopHoldingFund[];
      totalWeight: number;
    }
  >();

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

  return {
    holdings,
    totalFunds: breakdown.funds.length,
    periodYear: breakdown.periodYear,
    periodMonth: breakdown.periodMonth,
    updatedAt: new Date().toISOString(),
  };
}
