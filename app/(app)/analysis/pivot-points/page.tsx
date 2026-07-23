import type { Metadata } from "next";
import { CachedPivotPointsPage } from "@/components/public-data/cached-market-resources-pages";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX pivot points",
  description:
    "Daily pivot points and support/resistance levels for Pakistan Stock Exchange symbols.",
  path: "/analysis/pivot-points",
  keywords: ["PSX pivot points", "Pakistan stock support resistance"],
});

export default function PivotPointsPage() {
  return <CachedPivotPointsPage />;
}
