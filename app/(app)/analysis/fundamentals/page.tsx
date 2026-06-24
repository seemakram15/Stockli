import type { Metadata } from "next";
import { StockFundamentalsBrowser } from "@/components/stock/stock-fundamentals-browser";

export const metadata: Metadata = {
  title: "Stock Fundamentals · Stockli",
};

export default function StockFundamentalsPage() {
  return <StockFundamentalsBrowser />;
}
