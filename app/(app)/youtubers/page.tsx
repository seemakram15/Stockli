import type { Metadata } from "next";
import { CachedYoutubersPage } from "@/components/public-data/cached-youtubers-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX YouTube channels",
  description:
    "Follow Pakistan stock market YouTubers and market video creators tracked on MyStockli.",
  path: "/youtubers",
  keywords: ["PSX YouTube", "Pakistan stock market YouTube", "MyStockli youtubers"],
});

export default function YoutubersPage() {
  return <CachedYoutubersPage />;
}
