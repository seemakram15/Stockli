import type { Metadata } from "next";
import { CachedFundsBreakdownPage } from "@/components/public-data/cached-funds-breakdown-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Mutual fund holdings breakdown",
  description:
    "See which PSX stocks Pakistan mutual funds hold, filter by AMC and Islamic funds, and explore fund concentration on Stockli.",
  path: "/market/funds-breakdown",
  keywords: [
    "mutual fund holdings Pakistan",
    "fund breakdown PSX",
    "AMC holdings",
    "Islamic fund stocks",
  ],
});

export default function FundsBreakdownPage() {
  return <CachedFundsBreakdownPage />;
}
