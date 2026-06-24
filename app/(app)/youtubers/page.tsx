import type { Metadata } from "next";
import { PlaySquare } from "lucide-react";
import { getYoutubeVideos } from "@/lib/services/youtube";
import { PageHeader } from "@/components/page-header";
import { YoutubeVideosBoard } from "@/components/youtubers/youtube-videos-board";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Youtubers" };
export const dynamic = "force-dynamic";

export default async function YoutubersPage() {
  const data = await getYoutubeVideos();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Youtubers"
        description="Latest Pakistan market videos from selected YouTube channels, arranged newest first."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">
              <PlaySquare className="size-4" />
              YouTube
            </a>
          </Button>
        }
      />

      {data.videos.length ? (
        <YoutubeVideosBoard data={data} />
      ) : (
        <EmptyState
          icon={<PlaySquare className="size-6" />}
          title="YouTube videos are unavailable"
          description="The selected channel feeds could not be refreshed right now. Please try again shortly."
        />
      )}
    </div>
  );
}
