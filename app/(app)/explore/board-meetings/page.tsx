import type { Metadata } from "next";
import { CachedBoardMeetingsPage } from "@/components/public-data/cached-market-resources-pages";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "PSX board meetings calendar",
  description:
    "Upcoming and recent board meetings for Pakistan Stock Exchange listed companies.",
  path: "/explore/board-meetings",
  keywords: ["PSX board meetings", "Pakistan company board meeting calendar"],
});

export default function BoardMeetingsPage() {
  return <CachedBoardMeetingsPage />;
}
