"use client";

import * as React from "react";
import {
  Clock3,
  ExternalLink,
  Eye,
  Play,
  PlaySquare,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterPanel } from "@/components/ui/filter-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { YoutubeVideosData, YoutubeVideo } from "@/lib/services/youtube";

export function YoutubeVideosBoard({ data }: { data: YoutubeVideosData }) {
  const [channelId, setChannelId] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<YoutubeVideo | null>(null);

  const filteredVideos = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.videos.filter((video) => {
      const matchesChannel = channelId === "all" || video.channelId === channelId;
      const matchesQuery =
        !q ||
        video.title.toLowerCase().includes(q) ||
        video.channelName.toLowerCase().includes(q);
      return matchesChannel && matchesQuery;
    });
  }, [channelId, data.videos, query]);
  const selectedChannelName =
    channelId === "all"
      ? "All channels"
      : data.channels.find((feed) => feed.channel.id === channelId)?.channel.name ?? "Channel";
  const filterSummary = `${selectedChannelName} · ${filteredVideos.length} video${
    filteredVideos.length === 1 ? "" : "s"
  }`;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <FilterPanel title="Video filters" summary={filterSummary}>
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-center">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search videos or channels..."
                    className="h-11 pl-9"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChannelId("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <ChannelPill
                  active={channelId === "all"}
                  onClick={() => setChannelId("all")}
                  name="All channels"
                  handle={`${data.videos.length} latest videos`}
                  subscriberCount={`${data.channels.length} channels`}
                  avatarUrl={null}
                />
                {data.channels.map((feed) => (
                  <ChannelPill
                    key={feed.channel.id}
                    active={channelId === feed.channel.id}
                    onClick={() => setChannelId(feed.channel.id)}
                    name={feed.channel.name}
                    handle={feed.channel.displayHandle}
                    subscriberCount={`${feed.subscriberCount} subscribers`}
                    avatarUrl={feed.avatarUrl}
                    muted={feed.unavailable}
                  />
                ))}
              </div>
            </div>
          </FilterPanel>

          {data.unavailableCount > 0 ? (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {data.unavailableCount} channel{data.unavailableCount === 1 ? "" : "s"} could not
              be refreshed right now. Available videos are still shown below.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {filteredVideos.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} video={video} onWatch={() => setSelected(video)} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-44 flex-col items-center justify-center text-center">
            <PlaySquare className="size-10 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No videos found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Try another channel or clear the search filter.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-[min(1100px,94vw)]">
          {selected ? (
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#07110f] text-white shadow-2xl">
              <div className="aspect-video bg-black">
                <iframe
                  src={`${selected.embedUrl}?autoplay=1&rel=0`}
                  title={selected.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <DialogHeader className="space-y-4 px-5 py-5 sm:px-7 sm:py-6">
                <DialogTitle className="text-left text-xl font-semibold leading-snug text-white sm:text-2xl">
                  {selected.title}
                </DialogTitle>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={selected.channelName} src={selected.channelAvatarUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{selected.channelName}</p>
                      <p className="truncate text-sm text-white/55">{selected.channelHandle}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-white/70">
                    {selected.views ? <InfoChip icon={<Eye className="size-4" />} label={selected.views} /> : null}
                    {selected.publishedText ? (
                      <InfoChip icon={<Clock3 className="size-4" />} label={selected.publishedText} />
                    ) : null}
                    <InfoChip icon={<Users className="size-4" />} label={`${selected.subscriberCount} subscribers`} />
                  </div>
                </div>
              </DialogHeader>
            </section>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
      {icon}
      {label}
    </span>
  );
}

function ChannelPill({
  active,
  onClick,
  name,
  handle,
  subscriberCount,
  avatarUrl,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  handle: string;
  subscriberCount: string;
  avatarUrl: string | null;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left shadow-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent",
        muted && !active && "opacity-60"
      )}
    >
      <Avatar name={name} src={avatarUrl} active={active} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className={cn("block truncate text-xs", active ? "text-primary-foreground/75" : "text-muted-foreground")}>
          {handle}
        </span>
      </span>
      <span className={cn("hidden text-right text-xs font-semibold uppercase tracking-wide sm:block", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {subscriberCount}
      </span>
    </button>
  );
}

function VideoCard({ video, onWatch }: { video: YoutubeVideo; onWatch: () => void }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar name={video.channelName} src={video.channelAvatarUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{video.channelName}</h3>
          <p className="truncate text-xs text-muted-foreground">{video.channelHandle}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tabular-nums">{video.subscriberCount}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Subscribers
          </p>
        </div>
        <PlaySquare className="size-5 shrink-0 text-[#ff0000]" />
      </div>

      <button
        type="button"
        onClick={onWatch}
        className="group relative block aspect-video w-full overflow-hidden bg-muted text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnails use dynamic signed hosts. */}
        <img
          src={video.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/35" />
        <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow-lg backdrop-blur">
          <Play className="ml-1 size-6 fill-current" />
        </span>
        {video.duration ? (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/80 px-2 py-1 text-xs font-semibold text-white">
            {video.duration}
          </span>
        ) : null}
      </button>

      <div className="space-y-4 p-4">
        <h2 className="line-clamp-2 min-h-11 text-base font-semibold leading-snug">
          {video.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {video.publishedText ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {video.publishedText}
            </span>
          ) : null}
          {video.views ? (
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-3.5" />
              {video.views}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" />
            {video.subscriberCount}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={onWatch}>
            <Play className="size-4" />
            Watch
          </Button>
          <Button asChild variant="outline">
            <a href={video.url} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              YouTube
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

function Avatar({
  name,
  src,
  active,
}: {
  name: string;
  src: string | null;
  active?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- YouTube avatar URLs are dynamic and already optimized by YouTube.
      <img
        src={src}
        alt=""
        className="size-12 shrink-0 rounded-full border border-border object-cover"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
        active ? "border-primary-foreground/30 bg-primary-foreground/20" : "border-border bg-muted"
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
