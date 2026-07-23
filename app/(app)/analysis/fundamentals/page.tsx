import type { Metadata } from "next";
import { StockFundamentalsBrowser } from "@/components/stock/stock-fundamentals-browser";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX stock fundamentals & comparison",
  description:
    "Compare PSX company fundamentals, financial statements, ratios and peers. Research Pakistan stocks on Stockli.",
  path: "/analysis/fundamentals",
  keywords: [
    "PSX fundamentals",
    "Pakistan stock ratios",
    "financial statements PSX",
    "stock comparison Pakistan",
  ],
});

export default function StockFundamentalsPage() {
  return <StockFundamentalsBrowser />;
}
