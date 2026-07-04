import "server-only";
import type { DashboardTickerItem } from "@/components/dashboard/index-ticker-strip";
import { getGlobalMarketData, type GlobalMarketQuote } from "@/lib/services/global-markets";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";
import { getPortfolioCalendar, type StockCalendar } from "@/lib/services/daily-pl";
import { getPortfolioPerformance, type PerformanceResult } from "@/lib/services/performance";
import { getDashboard, type DashboardData } from "@/lib/services/portfolio";
import { getIndexSummariesCached } from "@/lib/services/history";
import { marketStatus } from "@/lib/psx/market-hours";
import type { IndexSummary } from "@/lib/types";

export interface PortfolioCommandPageData {
  dashboard: DashboardData;
  calendar: StockCalendar | null;
  headlineTicker: DashboardTickerItem | null;
  tickerItems: DashboardTickerItem[];
  performance: PerformanceResult;
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

export async function getPortfolioCommandPageData(): Promise<PortfolioCommandPageData> {
  const [dashboard, indexSummaries, oilMarket, commodityMarket] = await Promise.all([
    getDashboard(),
    getIndexSummariesCached().catch(() => []),
    getGlobalMarketData("oil").catch(() => null),
    getGlobalMarketData("commodities").catch(() => null),
  ]);

  const { holdings, portfolios } = dashboard;
  const performancePortfolios = portfolios
    .map((portfolio) => ({
      id: portfolio.id,
      name: portfolio.name,
      positions: holdings
        .filter((holding) => holding.portfolio_id === portfolio.id)
        .map((holding) => ({ symbol: holding.symbol, quantity: holding.quantity })),
    }))
    .filter((portfolio) => portfolio.positions.length > 0);

  const [calendar, performance] = await Promise.all([
    holdings.length ? getPortfolioCalendar(holdings, dashboard.transactions) : null,
    getPortfolioPerformance(performancePortfolios),
  ]);

  const { headlineTicker, tickerItems } = buildTickerStripItems(
    indexSummaries,
    oilMarket?.quotes ?? [],
    commodityMarket?.quotes ?? []
  );

  return {
    dashboard,
    calendar,
    headlineTicker,
    tickerItems,
    performance,
    market: marketStatus(),
    updatedAt: new Date().toISOString(),
  };
}

function buildTickerStripItems(
  indexes: IndexSummary[],
  oilQuotes: GlobalMarketQuote[],
  commodityQuotes: GlobalMarketQuote[]
) {
  const indexMap = new Map(indexes.map((index) => [index.symbol.toUpperCase(), index]));
  const marketMap = new Map(
    [...oilQuotes, ...commodityQuotes].map((quote) => [quote.symbol.toUpperCase(), quote])
  );

  const headlineTicker = indexToTicker(indexMap.get("KSE100")) ?? null;
  const tickerItems = [
    indexToTicker(indexMap.get("KSE30")),
    indexToTicker(indexMap.get("KMI30")),
    marketToTicker(marketMap.get("CL=F"), "WTI Crude Oil"),
    marketToTicker(marketMap.get("BZ=F"), "Brent Crude Oil"),
    marketToTicker(marketMap.get("GC=F"), "Gold"),
    marketToTicker(marketMap.get("SI=F"), "Silver"),
  ].filter(Boolean) as DashboardTickerItem[];

  return { headlineTicker, tickerItems };
}

function indexToTicker(index: IndexSummary | undefined): DashboardTickerItem | null {
  if (!index || !Number.isFinite(index.current)) return null;
  return {
    symbol: index.symbol,
    current: index.current,
    change: index.change,
    changePct: index.changePct,
  };
}

function marketToTicker(
  quote: GlobalMarketQuote | undefined,
  label: string
): DashboardTickerItem | null {
  if (
    !quote ||
    quote.price == null ||
    quote.change == null ||
    quote.changePct == null ||
    !Number.isFinite(quote.price)
  ) {
    return null;
  }
  return {
    symbol: getMarketDisplaySymbol(quote.symbol, quote.displaySymbol),
    label,
    current: quote.price,
    change: quote.change,
    changePct: quote.changePct,
  };
}
