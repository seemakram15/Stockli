import type { Metadata } from "next";
import { StockFundamentalsBrowser } from "@/components/stock/stock-fundamentals-browser";

export const metadata: Metadata = {
  title: "Fundamentals & Comparison · Stockli",
};

export default function StockFundamentalsPage() {
  return <StockFundamentalsBrowser />;
}
