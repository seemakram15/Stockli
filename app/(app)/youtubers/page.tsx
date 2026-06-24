import type { Metadata } from "next";
import { CachedYoutubersPage } from "@/components/public-data/cached-youtubers-page";

export const metadata: Metadata = { title: "Youtubers" };

export default function YoutubersPage() {
  return <CachedYoutubersPage />;
}
