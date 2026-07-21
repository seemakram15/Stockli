import { fetchWorldNews } from "@/lib/services/world-news";
import { NewsBoard } from "@/components/news/news-board";

export const revalidate = 900;

export const metadata = {
  title: "World News | Stockli",
  description: "Live global news filtered for Pakistan stock market impact",
};

export default async function NewsPage() {
  const articles = await fetchWorldNews();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <NewsBoard initialArticles={articles} />
    </div>
  );
}
