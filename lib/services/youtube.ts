import "server-only";
import { getStaleCached } from "@/lib/cache/stale";
import {
  canUseProductionPublicFallback,
  fetchProductionPublicData,
} from "@/lib/services/production-public";

const YOUTUBE_BASE = "https://www.youtube.com";
const YOUTUBE_TTL_SECONDS = 10 * 60;
const YOUTUBE_STALE_SECONDS = 6 * 60 * 60;

export interface YoutubeChannelConfig {
  id: string;
  name: string;
  handle: string;
  displayHandle: string;
  fallbackSubscribers: string;
}

export interface YoutubeVideo {
  id: string;
  title: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  duration: string | null;
  views: string | null;
  publishedText: string | null;
  publishedAt: string | null;
  channelId: string;
  channelName: string;
  channelHandle: string;
  channelUrl: string;
  channelAvatarUrl: string | null;
  subscriberCount: string;
}

export interface YoutubeChannelFeed {
  channel: YoutubeChannelConfig;
  avatarUrl: string | null;
  subscriberCount: string;
  videos: YoutubeVideo[];
  unavailable?: boolean;
}

export interface YoutubeVideosData {
  channels: YoutubeChannelFeed[];
  videos: YoutubeVideo[];
  updatedAt: string;
  unavailableCount: number;
}

export const YOUTUBE_CHANNELS: YoutubeChannelConfig[] = [
  {
    id: "UCemyu5MGL8sxInDTK8V8a-A",
    name: "Stockifyy",
    handle: "Stockifyyltd",
    displayHandle: "Stockifyy",
    fallbackSubscribers: "105K",
  },
  {
    id: "UCfTbnFryszAD4dvIw05Svog",
    name: "InvestKaar",
    handle: "InvestKaar",
    displayHandle: "InvestKaar",
    fallbackSubscribers: "150K",
  },
  {
    id: "UCU_s2lRotb65VMvAtFVnDuw",
    name: "Abdul Rehman Najam",
    handle: "AbdulRehmanNajamOfficial",
    displayHandle: "Abdul Rehman Najam",
    fallbackSubscribers: "129K",
  },
  {
    id: "UCmNW4ZhPq6MjDMDzE13tdGA",
    name: "Iftekhar Wasfi",
    handle: "iftekharwasfi786",
    displayHandle: "Iftekhar Wasfi",
    fallbackSubscribers: "33.9K",
  },
  {
    id: "UCAHCYWUuyb2iAVj_v51ejUw",
    name: "PSX with Irfan Haider",
    handle: "PSXwithirfanhaider",
    displayHandle: "PSX with Irfan Haider",
    fallbackSubscribers: "7.1K",
  },
  {
    id: "UCBSWZsNDvmfN4N4wfMVljNg",
    name: "Pearl Securities Ltd",
    handle: "pearlsecuritiesltd",
    displayHandle: "Pearl Securities",
    fallbackSubscribers: "8.2K",
  },
  {
    id: "UCqrxWe0rzVeeCMB2Uv9aMUQ",
    name: "Investment Matters",
    handle: "InvestmentMattersPakistan",
    displayHandle: "Ajj Ka Bazaar",
    fallbackSubscribers: "3.2K",
  },
  {
    id: "UCwSqZXqGpHksf41MbIGD6WQ",
    name: "WHY NEWS",
    handle: "whynews5688",
    displayHandle: "WHY NEWS",
    fallbackSubscribers: "16.0K",
  },
  {
    id: "UCUS7FxjSiXM9hcJtuDS_ETQ",
    name: "Financial Talks",
    handle: "FinancialTalks-1",
    displayHandle: "Financial Talks",
    fallbackSubscribers: "7.97K",
  },
];

export async function getYoutubeVideos(): Promise<YoutubeVideosData> {
  try {
    const cached = await getStaleCached({
      key: "youtube:videos:selected",
      ttlSeconds: YOUTUBE_TTL_SECONDS,
      staleSeconds: YOUTUBE_STALE_SECONDS,
      load: loadYoutubeVideos,
      isUsable: (data) => data.videos.length > 0,
    });
    return cached.value;
  } catch (error) {
    console.warn("[youtube] source unavailable:", error);
    if (canUseProductionPublicFallback()) {
      const remote = await fetchProductionPublicData<YoutubeVideosData>({
        path: "/api/public/youtubers",
        refererPath: "/youtubers",
        isUsable: (data) => Boolean(data?.videos?.length),
        label: "youtubers",
      });
      if (remote?.videos.length) return remote;
    }
    throw error;
  }
}

async function loadYoutubeVideos(): Promise<YoutubeVideosData> {
  const channels = await Promise.all(YOUTUBE_CHANNELS.map(fetchChannelFeed));
  const videos = channels
    .flatMap((feed) => feed.videos)
    .sort((a, b) => {
      const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bTime - aTime;
    });

  return {
    channels,
    videos,
    updatedAt: new Date().toISOString(),
    unavailableCount: channels.filter((channel) => channel.unavailable).length,
  };
}

async function fetchChannelFeed(channel: YoutubeChannelConfig): Promise<YoutubeChannelFeed> {
  try {
    const html = await fetchChannelHtml(channel);
    const data = extractInitialData(html);
    const avatarUrl = findAvatarUrl(data);
    const subscriberCount = findSubscriberCount(data) ?? channel.fallbackSubscribers;
    const videos = collectLockupVideos(data)
      .slice(0, 8)
      .map((video) => toYoutubeVideo(video, channel, avatarUrl, subscriberCount));

    return {
      channel,
      avatarUrl,
      subscriberCount,
      videos,
      unavailable: videos.length === 0,
    };
  } catch (error) {
    console.warn(`[youtube] ${channel.name} unavailable:`, error);
    return {
      channel,
      avatarUrl: null,
      subscriberCount: channel.fallbackSubscribers,
      videos: [],
      unavailable: true,
    };
  }
}

async function fetchChannelHtml(channel: YoutubeChannelConfig): Promise<string> {
  const candidates = [
    `${YOUTUBE_BASE}/@${channel.handle}/videos?hl=en`,
    `${YOUTUBE_BASE}/channel/${channel.id}/videos?hl=en`,
  ];

  let lastError: unknown;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MyStockli/1.0; +https://mystockli.com)",
          "Accept-Language": "en-US,en;q=0.9",
        },
        next: { revalidate: YOUTUBE_TTL_SECONDS },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`YouTube request failed: ${res.status}`);
      const html = await res.text();
      if (html.includes("ytInitialData")) return html;
      throw new Error("YouTube response missing ytInitialData");
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("YouTube channel unavailable");
}

function extractInitialData(html: string): unknown {
  const markers = ["var ytInitialData = ", "window[\"ytInitialData\"] = "];
  const marker = markers.find((item) => html.includes(item));
  if (!marker) throw new Error("Unable to find YouTube data");

  const start = html.indexOf(marker) + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === "\"") inString = false;
      continue;
    }

    if (char === "\"") inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(html.slice(start, index + 1)) as unknown;
    }
  }

  throw new Error("Unable to parse YouTube data");
}

interface RawYoutubeVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  duration: string | null;
  views: string | null;
  publishedText: string | null;
  publishedAt: string | null;
}

function collectLockupVideos(data: unknown): RawYoutubeVideo[] {
  const videos = new Map<string, RawYoutubeVideo>();

  walk(data, (node) => {
    const lockup = node.lockupViewModel as Record<string, unknown> | undefined;
    if (!lockup || lockup.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return;

    const id = textValue(lockup.contentId);
    const metadata = lockup.metadata as Record<string, unknown> | undefined;
    const lockupMetadata = metadata?.lockupMetadataViewModel as Record<string, unknown> | undefined;
    const titleModel = lockupMetadata?.title as Record<string, unknown> | undefined;
    const title = textValue(titleModel?.content);
    const thumbnailUrl = largestImageUrl(
      (((lockup.contentImage as Record<string, unknown> | undefined)?.thumbnailViewModel as
        | Record<string, unknown>
        | undefined)?.image as Record<string, unknown> | undefined)?.sources
    );

    if (!id || !title || !thumbnailUrl || videos.has(id)) return;

    const rows = ((((lockupMetadata?.metadata as Record<string, unknown> | undefined)
      ?.contentMetadataViewModel as Record<string, unknown> | undefined)?.metadataRows ?? []) ??
      []) as unknown[];
    const parts = rows.flatMap((row) =>
      (((row as Record<string, unknown>).metadataParts as unknown[]) ?? []).map((part) =>
        textValue(((part as Record<string, unknown>).text as Record<string, unknown> | undefined)?.content)
      )
    );
    const duration = findDuration(lockup);
    const views = parts.find((part) => part.toLowerCase().includes("view")) ?? null;
    const publishedText = parts.find((part) => part.toLowerCase().includes("ago")) ?? null;

    videos.set(id, {
      id,
      title,
      thumbnailUrl,
      duration,
      views,
      publishedText,
      publishedAt: estimatePublishedAt(publishedText),
    });
  });

  return Array.from(videos.values());
}

function toYoutubeVideo(
  raw: RawYoutubeVideo,
  channel: YoutubeChannelConfig,
  avatarUrl: string | null,
  subscriberCount: string
): YoutubeVideo {
  return {
    ...raw,
    url: `${YOUTUBE_BASE}/watch?v=${raw.id}`,
    embedUrl: `https://www.youtube.com/embed/${raw.id}`,
    channelId: channel.id,
    channelName: channel.name,
    channelHandle: channel.displayHandle,
    channelUrl: `${YOUTUBE_BASE}/@${channel.handle}`,
    channelAvatarUrl: avatarUrl,
    subscriberCount,
  };
}

function findAvatarUrl(data: unknown): string | null {
  const header = getRecord(data, "header");
  const pageHeader = getRecord(header?.pageHeaderRenderer, "content")?.pageHeaderViewModel;
  const image = getRecord(pageHeader, "image");
  const decoratedAvatar = getRecord(image?.decoratedAvatarViewModel, "avatar");
  const avatarImage = getRecord(decoratedAvatar?.avatarViewModel, "image");
  const headerAvatar = largestImageUrl(avatarImage?.sources);
  if (headerAvatar) return headerAvatar;

  let found: string | null = null;
  walk(data, (node) => {
    if (found) return;
    const avatar = node.avatarViewModel as Record<string, unknown> | undefined;
    found = largestImageUrl((avatar?.image as Record<string, unknown> | undefined)?.sources);
  });
  return found;
}

function getRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === "object" && !Array.isArray(child)
    ? (child as Record<string, unknown>)
    : undefined;
}

function findSubscriberCount(data: unknown): string | null {
  let found: string | null = null;
  walk(data, (node) => {
    if (found) return;
    const content = textValue((node.text as Record<string, unknown> | undefined)?.content);
    if (content.toLowerCase().includes("subscriber")) found = content.replace(/\s+subscribers?$/i, "");
  });
  return found;
}

function findDuration(lockup: Record<string, unknown>): string | null {
  let found: string | null = null;
  walk(lockup, (node) => {
    if (found) return;
    const badge = node.thumbnailBadgeViewModel as Record<string, unknown> | undefined;
    const text = textValue(badge?.text);
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) found = text;
  });
  return found;
}

function largestImageUrl(sources: unknown): string | null {
  if (!Array.isArray(sources)) return null;
  const images = sources
    .map((source) => source as { url?: string; width?: number })
    .filter((source) => source.url)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return images[0]?.url?.replace(/\\u0026/g, "&") ?? null;
}

function walk(value: unknown, visitor: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }

  const node = value as Record<string, unknown>;
  visitor(node);
  for (const child of Object.values(node)) walk(child, visitor);
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function estimatePublishedAt(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/^streamed\s+/, "").trim();
  const match = normalized.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  const date = new Date();
  const day = 24 * 60 * 60 * 1000;
  const multipliers: Record<string, number> = {
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day,
    week: 7 * day,
    month: 30 * day,
    year: 365 * day,
  };
  date.setTime(date.getTime() - amount * multipliers[unit]);
  return date.toISOString();
}
