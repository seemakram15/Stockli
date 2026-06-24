import type { Metadata } from "next";
import { CachedPortfoliosPage } from "@/components/portfolio/cached-portfolios-page";

export const metadata: Metadata = { title: "Portfolios" };
export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  return <CachedPortfoliosPage />;
}
