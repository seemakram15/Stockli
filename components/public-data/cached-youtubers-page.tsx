"use client";

import { PlaySquare } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { YoutubeVideosBoard } from "@/components/youtubers/youtube-videos-board";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { YoutubeVideosData } from "@/lib/services/youtube";

export function CachedYoutubersPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt } =
    usePersistentResource<YoutubeVideosData>({
      cacheKey: "public:youtubers",
      url: "/api/public/youtubers",
      refreshInterval: 10 * 60_000,
    });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Youtubers"
        description="Latest Pakistan market videos from selected YouTube channels, arranged newest first."
        actions={
          <>
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <Button asChild variant="outline" size="sm">
              <a href="https://www.youtube.com/" target="_blank" rel="noreferrer">
                <PlaySquare className="size-4" />
                YouTube
              </a>
            </Button>
          </>
        }
      />

      {data?.videos.length ? (
        <YoutubeVideosBoard data={data} />
      ) : isLoading ? (
        <PageLoadingState message="Loading Youtubers..." />
      ) : (
        <EmptyState
          icon={<PlaySquare className="size-6" />}
          title="YouTube videos are unavailable"
          description={
            error?.message ??
            "The selected channel feeds could not be refreshed right now. Please try again shortly."
          }
        />
      )}
    </div>
  );
}
