import type { Metadata } from "next";
import { StockAnalyzer } from "@/components/analysis/stock-analyzer";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX stock analyzer",
  description:
    "Analyze PSX companies in plain English with fundamentals, sector leaderboards, charts, dividend checks and side-by-side stock comparison.",
  path: "/analysis/stock-analyzer",
  keywords: [
    "PSX stock analyzer",
    "Pakistan stock analysis",
    "stock fundamentals Pakistan",
    "Stockli analyzer",
  ],
});

export default function StockAnalyzerPage() {
  return <StockAnalyzer />;
}
