import type { Metadata } from "next";
import { CachedFipiLipiPage } from "@/components/public-data/cached-fipi-lipi-page";

export const metadata: Metadata = {
  title: "FIPI / LIPI Data",
  description:
    "Daily foreign and local investor portfolio flows on the Pakistan Stock Exchange, by investor type and sector.",
};

export default function FipiLipiPage() {
  return <CachedFipiLipiPage />;
}
