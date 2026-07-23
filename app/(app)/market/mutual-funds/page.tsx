import type { Metadata } from "next";
import { CachedMufapPage } from "@/components/public-data/cached-mufap-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Pakistan mutual funds — MUFAP NAV & returns",
  description:
    "Browse Pakistan mutual funds with MUFAP NAVs, Islamic and conventional filters, AMC brands and daily returns on Stockli.",
  path: "/market/mutual-funds",
  keywords: [
    "Pakistan mutual funds",
    "MUFAP",
    "mutual fund NAV Pakistan",
    "Islamic mutual funds",
    "Stockli funds",
  ],
});

export default function MutualFundsPage() {
  return <CachedMufapPage kind="mutual" />;
}
