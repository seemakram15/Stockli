import type { Metadata } from "next";
import { CachedMufapPage } from "@/components/public-data/cached-mufap-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Pakistan ETFs — exchange traded funds",
  description:
    "Track Pakistan exchange traded funds (ETFs), prices and fund profiles alongside PSX equities on MyStockli.",
  path: "/market/etfs",
  keywords: ["Pakistan ETF", "PSX ETF", "exchange traded funds Pakistan", "MyStockli ETF"],
});

export default function EtfsPage() {
  return <CachedMufapPage kind="etfs" />;
}
