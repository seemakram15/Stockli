import { fetchWorldNews, fetchNationalNews } from "@/lib/services/world-news";
import { NewsBoard } from "@/components/news/news-board";

export const revalidate = 900;

export const metadata = {
  title: "Latest News | Stockli",
  description: "Live global and national news filtered for Pakistan stock market impact",
};

export default async function NewsPage() {
  const [worldArticles, nationalArticles] = await Promise.all([
    fetchWorldNews(),
    fetchNationalNews(),
  ]);
  return <NewsBoard worldArticles={worldArticles} nationalArticles={nationalArticles} />;
}
