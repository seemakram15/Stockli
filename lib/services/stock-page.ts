import "server-only";
import { getStockCalendar, type StockCalendar } from "@/lib/services/daily-pl";
import {
  enrichHoldings,
  getPortfolios,
  getTransactionsForSymbol,
  getWatchlistSymbols,
} from "@/lib/services/portfolio";
import { getStockDetail, type StockDetail } from "@/lib/services/stock";
import { marketStatus } from "@/lib/psx/market-hours";
import { normalizeSymbol } from "@/lib/security/validation";
import type { HoldingWithMetrics, Portfolio, Transaction } from "@/lib/types";

export interface StockPositionSummary {
  totalQty: number;
  costBasis: number;
  avgCost: number;
  marketValue: number;
  dayUnrealizedPL: number;
  dayUnrealizedPLPct: number;
  unrealizedPL: number;
  unrealizedPLPct: number;
}

export interface StockPageData {
  symbol: string;
  detail: StockDetail;
  portfolios: Portfolio[];
  watchedSymbols: string[];
  transactions: Transaction[];
  positionRows: HoldingWithMetrics[];
  positionSummary: StockPositionSummary;
  calendar: StockCalendar;
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

export async function getStockPageData(symbolRaw: string): Promise<StockPageData | null> {
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) return null;

  const [detail, portfolios, watchedSymbols, transactions] = await Promise.all([
    getStockDetail(symbol),
    getPortfolios(),
    getWatchlistSymbols(),
    getTransactionsForSymbol(symbol),
  ]);

  const positionRows = await enrichHoldings(detail.holdings, transactions);
  const calendar = await getStockCalendar(symbol, transactions);

  return {
    symbol,
    detail,
    portfolios,
    watchedSymbols,
    transactions,
    positionRows,
    positionSummary: summarizeStockPosition(positionRows),
    calendar,
    market: marketStatus(),
    updatedAt: new Date().toISOString(),
  };
}

export function summarizeStockPosition(rows: HoldingWithMetrics[]): StockPositionSummary {
  const totalQty = rows.reduce((sum, holding) => sum + holding.quantity, 0);
  const costBasis = rows.reduce((sum, holding) => sum + holding.costBasis, 0);
  const marketValue = rows.reduce((sum, holding) => sum + holding.marketValue, 0);
  const dayUnrealizedPL = rows.reduce((sum, holding) => sum + holding.dayChange, 0);
  const prevValue = marketValue - dayUnrealizedPL;
  const unrealizedPL = rows.reduce((sum, holding) => sum + holding.unrealizedPL, 0);

  return {
    totalQty,
    costBasis,
    avgCost: totalQty ? costBasis / totalQty : 0,
    marketValue,
    dayUnrealizedPL,
    dayUnrealizedPLPct: prevValue ? (dayUnrealizedPL / prevValue) * 100 : 0,
    unrealizedPL,
    unrealizedPLPct: costBasis ? (unrealizedPL / costBasis) * 100 : 0,
  };
}
