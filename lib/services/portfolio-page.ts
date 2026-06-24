import "server-only";
import { getPortfolioView } from "@/lib/services/portfolio";
import { getPortfolioCalendar, type StockCalendar } from "@/lib/services/daily-pl";
import { marketStatus } from "@/lib/psx/market-hours";
import type { PortfolioWithMetrics } from "@/lib/types";

export interface PortfolioPageData {
  portfolio: PortfolioWithMetrics;
  calendar: StockCalendar | null;
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

export async function getPortfolioPageData(id: string): Promise<PortfolioPageData | null> {
  const portfolio = await getPortfolioView(id);
  if (!portfolio) return null;

  const calendar = portfolio.holdings.length
    ? await getPortfolioCalendar(portfolio.holdings, portfolio.transactions)
    : null;

  return {
    portfolio,
    calendar,
    market: marketStatus(),
    updatedAt: new Date().toISOString(),
  };
}
