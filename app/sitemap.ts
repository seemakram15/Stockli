import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { SEED_TICKERS } from "@/lib/psx/symbols";
import { MARKET_NAV_ITEMS, TOOL_NAV_ITEMS, EXPLORE_NAV_ITEMS } from "@/lib/constants";

const STATIC_PUBLIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/market", changeFrequency: "hourly", priority: 0.95 },
  { path: "/market/sectors", changeFrequency: "daily", priority: 0.85 },
  { path: "/market/mutual-funds", changeFrequency: "daily", priority: 0.9 },
  { path: "/market/etfs", changeFrequency: "daily", priority: 0.8 },
  { path: "/market/funds-breakdown", changeFrequency: "daily", priority: 0.85 },
  { path: "/market/strategy", changeFrequency: "daily", priority: 0.8 },
  { path: "/market/fipi-lipi", changeFrequency: "daily", priority: 0.85 },
  { path: "/market/mf-top-holdings", changeFrequency: "daily", priority: 0.75 },
  { path: "/news", changeFrequency: "hourly", priority: 0.8 },
  { path: "/youtubers", changeFrequency: "weekly", priority: 0.55 },
];

function collectMarketHrefs(): string[] {
  const hrefs: string[] = [];
  for (const item of MARKET_NAV_ITEMS) {
    if ("href" in item && typeof item.href === "string") {
      hrefs.push(item.href);
      continue;
    }
    if ("children" in item && Array.isArray(item.children)) {
      for (const child of item.children) hrefs.push(child.href);
    }
  }
  return hrefs;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const push = (
    path: string,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number
  ) => {
    if (!path.startsWith("/")) return;
    // Keep a trailing slash only on the homepage so <loc> matches the canonical host root.
    const url = path === "/" ? `${config.siteUrl}/` : `${config.siteUrl}${path}`;
    if (seen.has(url)) return;
    seen.add(url);
    entries.push({ url, lastModified: now, changeFrequency, priority });
  };

  for (const item of STATIC_PUBLIC_PATHS) {
    push(item.path, item.changeFrequency, item.priority);
  }

  for (const href of collectMarketHrefs()) {
    push(href, "hourly", 0.85);
  }
  for (const item of TOOL_NAV_ITEMS) {
    push(item.href, "weekly", 0.75);
  }
  for (const item of EXPLORE_NAV_ITEMS) {
    if ("external" in item && item.external) continue;
    push(item.href, "weekly", 0.65);
  }

  // High-intent PSX stock landing pages (seed universe of liquid names).
  for (const ticker of SEED_TICKERS.slice(0, 60)) {
    push(`/stock/${ticker.symbol}`, "hourly", 0.7);
  }

  return entries;
}
