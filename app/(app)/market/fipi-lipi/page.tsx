import type { Metadata } from "next";
import { CachedFipiLipiPage } from "@/components/public-data/cached-fipi-lipi-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "FIPI / LIPI — foreign & local PSX flows",
  description:
    "Daily foreign and local investor portfolio flows on the Pakistan Stock Exchange, by investor type and sector.",
  path: "/market/fipi-lipi",
  keywords: ["FIPI", "LIPI", "PSX foreign investment", "Pakistan stock flows"],
});

export default function FipiLipiPage() {
  return <CachedFipiLipiPage />;
}
