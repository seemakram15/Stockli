"use client";

import { PlaySquare } from "lucide-react";
import { CacheStatusBadge } from "@/components/cache/cache-status-badge";
import { MarketRefreshButton } from "@/components/market/market-refresh-button";
import { EmptyState } from "@/components/empty-state";
import { PageLoadingState } from "@/components/loading/page-loading-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { YoutubeVideosBoard } from "@/components/youtubers/youtube-videos-board";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import type { YoutubeVideosData } from "@/lib/services/youtube";

export function CachedYoutubersPage() {
  const { data, error, isLoading, isRefreshing, isFromDeviceCache, cachedAt, refreshNow } =
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
        icon={<PlaySquare />}
        eyebrow="Market creators"
        accent="rose"
        actions={
          <>
            <CacheStatusBadge
              updatedAt={data?.updatedAt}
              cachedAt={cachedAt}
              isFromDeviceCache={isFromDeviceCache}
              isRefreshing={isRefreshing}
            />
            <MarketRefreshButton
              color="rose"
              label="Refresh videos"
              onRefresh={async () => {
                const result = await refreshNow();
                const count = (result as YoutubeVideosData | undefined)?.videos?.length;
                return count ? `${count} videos loaded` : undefined;
              }}
              stages={["Fetching YouTube channels", "Loading latest videos", "Updating feed"]}
            />
            <Button asChild size="sm" className="bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-sm shadow-rose-500/25 hover:from-rose-500 hover:to-pink-400 hover:text-white">
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
        <PageLoadingState message="Loading Youtubers..." variant="list" />
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
