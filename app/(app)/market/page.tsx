import type { Metadata } from "next";
import { CachedPsxMarketPage } from "@/components/public-data/cached-psx-market-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX live market — Pakistan Stock Exchange",
  description:
    "Live PSX market board with KSE-100 movers, volumes, sectors and Pakistan stock prices. Track the Pakistan Stock Exchange on Stockli.",
  path: "/market",
  keywords: [
    "PSX live",
    "Pakistan Stock Exchange",
    "KSE 100",
    "PSX share price",
    "Pakistan stocks today",
    "Stockli market",
  ],
});

export default function MarketPage() {
  return <CachedPsxMarketPage />;
}
