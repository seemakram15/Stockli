import type { Metadata } from "next";
import { CachedMFTopHoldingsPage } from "@/components/public-data/cached-mf-top-holdings-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Top holdings by mutual funds",
  description:
    "See which PSX stocks Pakistan mutual funds hold the most — aggregated top holdings across funds.",
  path: "/market/mf-top-holdings",
  keywords: ["mutual fund top holdings Pakistan", "PSX institutional holdings"],
});

export default function MFTopHoldingsPage() {
  return <CachedMFTopHoldingsPage />;
}
