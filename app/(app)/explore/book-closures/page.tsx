import type { Metadata } from "next";
import { CachedBookClosuresPage } from "@/components/public-data/cached-market-resources-pages";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX book closures",
  description:
    "Book closure dates for PSX listed companies — dividends, entitlements and corporate actions.",
  path: "/explore/book-closures",
  keywords: ["PSX book closure", "Pakistan stock book closure dates"],
});

export default function BookClosuresPage() {
  return <CachedBookClosuresPage />;
}
