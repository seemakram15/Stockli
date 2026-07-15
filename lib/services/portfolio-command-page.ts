import "server-only";
import type { DashboardTickerItem } from "@/components/dashboard/index-ticker-strip";
import { getGlobalMarketData, type GlobalMarketQuote } from "@/lib/services/global-markets";
import { getMarketDisplaySymbol } from "@/lib/market-symbols";
import { getPortfolioCalendar, type StockCalendar } from "@/lib/services/daily-pl";
import type { PerformanceResult } from "@/lib/services/performance";
import {
  buildDashboardData,
  enrichHoldings,
  getDashboardRaw,
  type DashboardData,
} from "@/lib/services/portfolio";
import { getIndexSummariesCached } from "@/lib/services/history";
import { marketStatus, psxLocalDateString } from "@/lib/psx/market-hours";
import type { IndexSummary } from "@/lib/types";

export interface PortfolioCommandPageData {
  dashboard: DashboardData;
  calendar: StockCalendar | null;
  /** Each portfolio's own most recent calendar day, keyed by portfolio id —
   *  lets the per-portfolio "Day P/L" cards agree with the gain/loss
   *  calendar instead of recomputing independently from live quotes. */
  portfolioDayPL: Record<string, { dayPL: number; dayPLPct: number } | null>;
  headlineTicker: DashboardTickerItem | null;
  tickerItems: DashboardTickerItem[];
  performance: PerformanceResult | null;
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

export async function getPortfolioCommandPageData(): Promise<PortfolioCommandPageData> {
  const [{ portfolios, holdings, transactions }, indexSummaries, oilMarket, commodityMarket] =
    await Promise.all([
      getDashboardRaw(),
      getIndexSummariesCached().catch(() => []),
      getGlobalMarketData("oil").catch(() => null),
      getGlobalMarketData("commodities").catch(() => null),
    ]);

  const [enriched, calendar, portfolioDayPL] = await Promise.all([
    enrichHoldings(holdings, transactions),
    holdings.length ? getPortfolioCalendar(holdings, transactions) : Promise.resolve(null),
    getPortfolioDayPLByPortfolio(portfolios, holdings, transactions),
  ]);

  const dashboard = buildDashboardData(portfolios, enriched, transactions);

  const { headlineTicker, tickerItems } = buildTickerStripItems(
    indexSummaries,
    oilMarket?.quotes ?? [],
    commodityMarket?.quotes ?? []
  );

  return {
    dashboard,
    calendar,
    portfolioDayPL,
    headlineTicker,
    tickerItems,
    performance: null,
    market: marketStatus(),
    updatedAt: new Date().toISOString(),
  };
}

async function getPortfolioDayPLByPortfolio(
  portfolios: Awaited<ReturnType<typeof getDashboardRaw>>["portfolios"],
  holdings: Awaited<ReturnType<typeof getDashboardRaw>>["holdings"],
  transactions: Awaited<ReturnType<typeof getDashboardRaw>>["transactions"]
): Promise<Record<string, { dayPL: number; dayPLPct: number } | null>> {
  const entries = await Promise.all(
    portfolios.map(async (p) => {
      const pHoldings = holdings.filter((h) => h.portfolio_id === p.id);
      if (pHoldings.length === 0) return [p.id, null] as const;
      const pTransactions = transactions.filter((t) => t.portfolio_id === p.id);
      const cal = await getPortfolioCalendar(pHoldings, pTransactions);
      const last = cal.days.at(-1) ?? null;
      // Only trust this as "today" once its own EOD candle is actually
      // published for today's date — otherwise it's still yesterday's row,
      // and the client should fall back to its live-quote calculation.
      const isToday = last?.date === psxLocalDateString();
      return [p.id, last && isToday ? { dayPL: last.dayPL, dayPLPct: last.dayPLPct } : null] as const;
    })
  );
  return Object.fromEntries(entries);
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
