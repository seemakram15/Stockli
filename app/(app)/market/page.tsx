import type { Metadata } from "next";
import { CachedPsxMarketPage } from "@/components/public-data/cached-psx-market-page";

export const metadata: Metadata = { title: "Market" };

export default function MarketPage() {
  return <CachedPsxMarketPage />;
}
