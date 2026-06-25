import type { Metadata } from "next";
import { CachedMarketStrategyPage } from "@/components/public-data/cached-market-strategy-page";

export const metadata: Metadata = { title: "Funds Daily Returns Report" };

export default function MarketStrategyPage() {
  return <CachedMarketStrategyPage />;
}
