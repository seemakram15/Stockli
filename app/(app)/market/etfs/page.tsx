import type { Metadata } from "next";
import { CachedMufapPage } from "@/components/public-data/cached-mufap-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Pakistan ETFs — exchange traded funds",
  description:
    "Track Pakistan exchange traded funds (ETFs), prices and fund profiles alongside PSX equities on Stockli.",
  path: "/market/etfs",
  keywords: ["Pakistan ETF", "PSX ETF", "exchange traded funds Pakistan", "Stockli ETF"],
});

export default function EtfsPage() {
  return <CachedMufapPage kind="etfs" />;
}
