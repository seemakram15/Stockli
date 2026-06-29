import type { Metadata } from "next";
import { StockAnalyzer } from "@/components/analysis/stock-analyzer";

export const metadata: Metadata = {
  title: "Stock Analyzer · Stockli",
  description:
    "Analyze PSX companies in plain English with fundamentals, charts, dividend checks and side-by-side stock comparison.",
};

export default function StockAnalyzerPage() {
  return <StockAnalyzer />;
}
