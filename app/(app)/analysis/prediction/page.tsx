import type { Metadata } from "next";
import { getPredictionPageData } from "@/lib/services/psx-prediction";
import { PredictionBoard } from "@/components/analysis/prediction-board";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX next-day market prediction",
  description:
    "PSX next-session outlook from live technicals, foreign flows, global macro and news sentiment on Stockli.",
  path: "/analysis/prediction",
  keywords: ["PSX prediction", "KSE-100 outlook", "Pakistan stock market forecast"],
});

export default async function PredictionPage() {
  const data = await getPredictionPageData();
  return <PredictionBoard data={data} />;
}
