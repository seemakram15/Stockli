import "server-only";
import { getDashboard } from "@/lib/services/portfolio";
import { marketStatus } from "@/lib/psx/market-hours";
import type { HoldingWithMetrics, Portfolio } from "@/lib/types";

export interface PortfoliosPageData {
  portfolios: Portfolio[];
  holdings: HoldingWithMetrics[];
  market: ReturnType<typeof marketStatus>;
  updatedAt: string;
}

export async function getPortfoliosPageData(): Promise<PortfoliosPageData> {
  const dashboard = await getDashboard();
  return {
    portfolios: dashboard.portfolios,
    holdings: dashboard.holdings,
    market: marketStatus(),
    updatedAt: new Date().toISOString(),
  };
}
