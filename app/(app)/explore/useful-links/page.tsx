import type { Metadata } from "next";
import { CachedUsefulLinksPage } from "@/components/public-data/cached-market-resources-pages";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Useful PSX investing links",
  description:
    "Curated Pakistan Stock Exchange, SECP, NCCPL, CDC and broker resources for investors on Stockli.",
  path: "/explore/useful-links",
});

export default function UsefulLinksPage() {
  return <CachedUsefulLinksPage />;
}
