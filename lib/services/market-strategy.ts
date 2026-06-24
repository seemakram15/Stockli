import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import { getIndexCards } from "@/lib/services/market";
import { getMufapFunds, type MufapFund } from "@/lib/services/mufap";

export interface StrategyFundRow {
  fundId: string | null;
  name: string;
  amc: string;
  amcShort: string;
  amcLogoUrl: string | null;
  type: string;
  classFilter: MufapFund["classFilter"];
  returnPct: number | null;
  estimatedReturn: number | null;
}

export interface MarketStrategyData {
  islamic: StrategyFundRow[];
  conventional: StrategyFundRow[];
  updatedAt: string;
  sourceUrl: string;
  investmentAmount: number;
  indexBadges: Array<{
    symbol: string;
    current: number;
    change: number;
    changePct: number;
  }>;
  summary: {
    best: StrategyFundRow | null;
    worst: StrategyFundRow | null;
    avgEstimatedReturn: number;
    positiveCount: number;
    negativeCount: number;
  };
}

export async function getMarketStrategyData(): Promise<MarketStrategyData> {
  const cached = await getStaleCached({
    key: "market-strategy:stock-funds",
    ttlSeconds: 5 * 60,
    staleSeconds: 6 * 60 * 60,
    load: loadMarketStrategyData,
    isUsable: (data) => data.islamic.length + data.conventional.length > 0,
  });
  return cached.value;
}

async function loadMarketStrategyData(): Promise<MarketStrategyData> {
  const [fundsData, indexCards] = await Promise.all([
    getMufapFunds(),
    getIndexCards().catch(() => []),
  ]);
  const rows = fundsData.funds
    .filter(isStockFund)
    .map(toStrategyRow)
    .sort((a, b) => a.amc.localeCompare(b.amc) || a.name.localeCompare(b.name));
  const priced = rows.filter((row) => row.estimatedReturn != null);
  const ranked = [...priced].sort(
    (a, b) => (b.estimatedReturn ?? 0) - (a.estimatedReturn ?? 0)
  );
  const islamic = rows.filter((row) => row.classFilter === "islamic");
  const conventional = rows.filter((row) => row.classFilter !== "islamic");
  const totalEstimated = priced.reduce((sum, row) => sum + (row.estimatedReturn ?? 0), 0);

  return {
    islamic,
    conventional,
    updatedAt: fundsData.updatedAt,
    sourceUrl: fundsData.sourceUrl,
    investmentAmount: fundsData.investmentAmount,
    indexBadges: indexCards.slice(0, 3).map((card) => ({
      symbol: card.symbol,
      current: card.current,
      change: card.change,
      changePct: card.changePct,
    })),
    summary: {
      best: ranked[0] ?? null,
      worst: ranked[ranked.length - 1] ?? null,
      avgEstimatedReturn: priced.length ? totalEstimated / priced.length : 0,
      positiveCount: priced.filter((row) => (row.estimatedReturn ?? 0) > 0).length,
      negativeCount: priced.filter((row) => (row.estimatedReturn ?? 0) < 0).length,
    },
  };
}

function toStrategyRow(fund: MufapFund): StrategyFundRow {
  return {
    fundId: fund.fundId,
    name: fund.name,
    amc: fund.amc,
    amcShort: fund.amcShort || fund.amc,
    amcLogoUrl: fund.amcLogoUrl,
    type: fund.type,
    classFilter: fund.classFilter,
    returnPct: fund.d1,
    estimatedReturn: fund.profitOn100k,
  };
}

function isStockFund(fund: MufapFund) {
  if (fund.classFilter === "pension") return false;
  const haystack = `${fund.name} ${fund.type} ${fund.category} ${fund.sector}`.toLowerCase();
  if (/\b(income|money market|cash|sovereign|pension|vps)\b/.test(haystack)) return false;
  return /\b(stock|equity|index|sector)\b/.test(haystack);
}
