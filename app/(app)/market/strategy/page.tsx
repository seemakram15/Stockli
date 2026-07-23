import type { Metadata } from "next";
import { CachedMarketStrategyPage } from "@/components/public-data/cached-market-strategy-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Mutual funds daily returns report",
  description:
    "Daily mutual fund returns report for Pakistan funds tracked on Stockli — compare AMC and category performance.",
  path: "/market/strategy",
  keywords: ["Pakistan mutual fund returns", "MUFAP daily returns", "AMC performance"],
});

export default function MarketStrategyPage() {
  return <CachedMarketStrategyPage />;
}
