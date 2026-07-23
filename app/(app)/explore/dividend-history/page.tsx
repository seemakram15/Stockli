import type { Metadata } from "next";
import { CachedDividendHistoryPage } from "@/components/public-data/cached-market-resources-pages";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX dividend history",
  description:
    "Dividend history and payout records for Pakistan Stock Exchange listed companies.",
  path: "/explore/dividend-history",
  keywords: ["PSX dividends", "Pakistan stock dividend history"],
});

export default function DividendHistoryPage() {
  return <CachedDividendHistoryPage />;
}
