import type { Metadata } from "next";
import { CachedMarketStrategyPage } from "@/components/public-data/cached-market-strategy-page";

export const metadata: Metadata = { title: "Market Strategy" };

export default function MarketStrategyPage() {
  return <CachedMarketStrategyPage />;
}
