import type { Metadata } from "next";
import { fetchWorldNews, fetchNationalNews } from "@/lib/services/world-news";
import { NewsBoard } from "@/components/news/news-board";
import { buildPageMetadata } from "@/lib/seo";

export const revalidate = 900;

export const metadata: Metadata = buildPageMetadata({
  title: "Market news — Pakistan & global",
  description:
    "Live global and national news with PSX market context. Stay updated on Pakistan stocks, economy and world markets on Stockli.",
  path: "/news",
  keywords: ["PSX news", "Pakistan stock news", "market news Pakistan", "Stockli news"],
});

export default async function NewsPage() {
  const [worldArticles, nationalArticles] = await Promise.all([
    fetchWorldNews(),
    fetchNationalNews(),
  ]);
  return (
    <NewsBoard
      worldArticles={worldArticles}
      nationalArticles={nationalArticles}
    />
  );
}
