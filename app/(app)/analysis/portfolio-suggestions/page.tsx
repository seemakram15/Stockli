import type { Metadata } from "next";
import { PortfolioSuggestions } from "@/components/analysis/portfolio-suggestions";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX portfolio suggestions",
  description:
    "Build a diversified PSX portfolio idea from cached fundamentals, sector rankings and plain-English AI notes.",
  path: "/analysis/portfolio-suggestions",
  keywords: ["PSX portfolio suggestions", "Pakistan stock portfolio ideas"],
});

export default function PortfolioSuggestionsPage() {
  return <PortfolioSuggestions />;
}
