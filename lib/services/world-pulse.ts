import "server-only";

import { parse } from "node-html-parser";
import {
  WORLD_PULSE_LAYERS,
  WORLD_PULSE_LAYER_META,
  type WorldPulseData,
  type WorldPulseDisasterEvent,
  type WorldPulseHeadline,
  type WorldPulseHotspot,
  type WorldPulseTimeRange,
  type WorldPulseView,
} from "@/lib/analysis/world-pulse";
import { getStaleCached } from "@/lib/cache/stale";
import {
  getGlobalMarketData,
  getGlobalMarketMeta,
  type GlobalMarketData,
  type MarketUniverse,
} from "@/lib/services/global-markets";

export {
  WORLD_PULSE_LAYERS,
  WORLD_PULSE_TIME_RANGES,
  WORLD_PULSE_VIEW_LABELS,
  WORLD_PULSE_VIEWS,
} from "@/lib/analysis/world-pulse";

const WORLD_PULSE_TTL_SECONDS = 5 * 60;
const WORLD_PULSE_STALE_SECONDS = 20 * 60;
const FETCH_TIMEOUT_MS = 5_000;
const GOOGLE_NEWS_BASE = "https://news.google.com/rss/search";
const GDACS_RSS_URL = "https://www.gdacs.org/xml/rss.xml";

type HotspotSeed = {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  aliases: string[];
};

const HOTSPOTS: HotspotSeed[] = [
  {
    id: "ukraine",
    name: "Ukraine Front",
    region: "Europe",
    country: "Ukraine",
    lat: 50.4501,
    lon: 30.5234,
    aliases: ["ukraine", "kyiv", "kiev", "donetsk", "kharkiv", "odesa", "zelensky", "russia"],
  },
  {
    id: "israel-gaza",
    name: "Israel and Gaza",
    region: "Middle East",
    country: "Israel / Palestine",
    lat: 31.7683,
    lon: 35.2137,
    aliases: ["israel", "gaza", "hamas", "west bank", "jerusalem", "tel aviv"],
  },
  {
    id: "iran",
    name: "Iran Watch",
    region: "Middle East",
    country: "Iran",
    lat: 35.6892,
    lon: 51.389,
    aliases: ["iran", "tehran", "khamenei", "isfahan", "nuclear"],
  },
  {
    id: "pakistan",
    name: "Pakistan Watch",
    region: "Asia",
    country: "Pakistan",
    lat: 33.6844,
    lon: 73.0479,
    aliases: ["pakistan", "islamabad", "karachi", "lahore", "quetta"],
  },
  {
    id: "india",
    name: "India Watch",
    region: "Asia",
    country: "India",
    lat: 28.6139,
    lon: 77.209,
    aliases: ["india", "new delhi", "kashmir", "mumbai"],
  },
  {
    id: "afghanistan",
    name: "Afghanistan Watch",
    region: "Asia",
    country: "Afghanistan",
    lat: 34.5553,
    lon: 69.2075,
    aliases: ["afghanistan", "kabul", "taliban"],
  },
  {
    id: "china",
    name: "China Watch",
    region: "Asia",
    country: "China",
    lat: 39.9042,
    lon: 116.4074,
    aliases: ["china", "beijing", "xinjiang", "shanghai"],
  },
  {
    id: "taiwan",
    name: "Taiwan Strait",
    region: "Asia",
    country: "Taiwan",
    lat: 25.033,
    lon: 121.5654,
    aliases: ["taiwan", "taipei", "strait"],
  },
  {
    id: "korea",
    name: "Korean Peninsula",
    region: "Asia",
    country: "South Korea",
    lat: 37.5665,
    lon: 126.978,
    aliases: ["korea", "seoul", "north korea", "pyongyang"],
  },
  {
    id: "japan",
    name: "Japan Watch",
    region: "Asia",
    country: "Japan",
    lat: 35.6762,
    lon: 139.6503,
    aliases: ["japan", "tokyo", "osaka"],
  },
  {
    id: "philippines",
    name: "Philippines and SCS",
    region: "Asia",
    country: "Philippines",
    lat: 14.5995,
    lon: 120.9842,
    aliases: ["philippines", "manila", "south china sea", "spratly"],
  },
  {
    id: "red-sea",
    name: "Red Sea Shipping",
    region: "Middle East",
    country: "Red Sea",
    lat: 21.4858,
    lon: 39.1925,
    aliases: ["red sea", "houthi", "yemen", "aden", "shipping", "suez"],
  },
  {
    id: "venezuela",
    name: "Venezuela Watch",
    region: "Americas",
    country: "Venezuela",
    lat: 10.4806,
    lon: -66.9036,
    aliases: ["venezuela", "caracas"],
  },
  {
    id: "europe-energy",
    name: "European Energy Desk",
    region: "Europe",
    country: "Europe",
    lat: 50.1109,
    lon: 8.6821,
    aliases: ["europe", "eu", "brussels", "frankfurt", "gas", "sanctions"],
  },
];

const VIEW_PRESETS: Record<
  WorldPulseView,
  {
    label: string;
    center: [number, number];
    zoom: number;
    bounds: [[number, number], [number, number]];
  }
> = {
  world: {
    label: "World",
    center: [12, 22],
    zoom: 1.35,
    bounds: [[-179, -58], [179, 83]],
  },
  asia: {
    label: "Asia",
    center: [86, 29],
    zoom: 2.45,
    bounds: [[45, -12], [150, 61]],
  },
  "middle-east": {
    label: "Middle East",
    center: [46, 29],
    zoom: 3.1,
    bounds: [[22, 8], [68, 42]],
  },
  europe: {
    label: "Europe",
    center: [16, 49],
    zoom: 3.05,
    bounds: [[-14, 34], [45, 72]],
  },
  americas: {
    label: "Americas",
    center: [-77, 14],
    zoom: 2.15,
    bounds: [[-168, -57], [-30, 72]],
  },
  africa: {
    label: "Africa",
    center: [22, 4],
    zoom: 2.5,
    bounds: [[-22, -36], [58, 38]],
  },
};

const MARKET_COORDINATES: Record<
  string,
  {
    lat: number;
    lon: number;
  }
> = {
  "^GSPC": { lat: 40.7128, lon: -74.006 },
  "^GSPTSE": { lat: 43.6532, lon: -79.3832 },
  "^MXX": { lat: 19.4326, lon: -99.1332 },
  "^BVSP": { lat: -23.5558, lon: -46.6396 },
  "^FTSE": { lat: 51.5072, lon: -0.1276 },
  "^GDAXI": { lat: 50.1109, lon: 8.6821 },
  "^FCHI": { lat: 48.8566, lon: 2.3522 },
  "FTSEMIB.MI": { lat: 45.4642, lon: 9.19 },
  "^NSEI": { lat: 19.076, lon: 72.8777 },
  "^HSI": { lat: 22.3193, lon: 114.1694 },
  "000001.SS": { lat: 31.2304, lon: 121.4737 },
  "^N225": { lat: 35.6762, lon: 139.6503 },
  "^KS11": { lat: 37.5665, lon: 126.978 },
  "^AXJO": { lat: -33.8688, lon: 151.2093 },
  "^TA125.TA": { lat: 32.0853, lon: 34.7818 },
  "^CASE30": { lat: 30.0444, lon: 31.2357 },
  "^JN0U.JO": { lat: -26.2041, lon: 28.0473 },
};

export async function getWorldPulseData({
  view,
  timeRange,
}: {
  view: WorldPulseView;
  timeRange: WorldPulseTimeRange;
}) {
  const focus = VIEW_PRESETS[view];

  const cached = await getStaleCached<WorldPulseData>({
    key: `public:world-pulse:v1:${view}:${timeRange}`,
    ttlSeconds: WORLD_PULSE_TTL_SECONDS,
    staleSeconds: WORLD_PULSE_STALE_SECONDS,
    load: async () => {
      const [
        headlines,
        disasters,
        world,
        commodities,
        oil,
        crypto,
      ] = await Promise.all([
        safeResolve(() => getIntelFeed(timeRange), []),
        safeResolve(() => getDisasterFeed(timeRange), []),
        safeMarketData("world"),
        safeMarketData("commodities"),
        safeMarketData("oil"),
        safeMarketData("crypto"),
      ]);

      const hotspots = buildHotspots(headlines).filter((hotspot) =>
        isWithinView(hotspot.lon, hotspot.lat, view)
      );
      const filteredDisasters = disasters.filter((event) =>
        isWithinView(event.lon, event.lat, view)
      );
      const marketMarkers = buildMarketMarkers(world).filter((marker) =>
        isWithinView(marker.lon, marker.lat, view)
      );
      const orderedHeadlines = prioritizeHeadlinesForView(headlines, view);
      const marketSnapshot = buildMarketSnapshot(world, commodities, oil, crypto);

      return {
        updatedAt: new Date().toISOString(),
        view,
        timeRange,
        regionLabel: focus.label,
        focus,
        layerOptions: WORLD_PULSE_LAYERS.map((key) => ({
          key,
          label: WORLD_PULSE_LAYER_META[key].label,
          count:
            key === "conflicts"
              ? hotspots.length
              : key === "disasters"
                ? filteredDisasters.length
                : marketMarkers.length,
          description: WORLD_PULSE_LAYER_META[key].description,
        })),
        intelFeed: orderedHeadlines.slice(0, 14),
        hotspots: hotspots.slice(0, 10),
        disasters: filteredDisasters.slice(0, 12),
        marketMarkers,
        marketSnapshot,
        summary: {
          hotspotsLive: hotspots.length,
          disasterAlerts: filteredDisasters.length,
          leadHotspot: hotspots[0]?.name ?? null,
          leadDisaster: filteredDisasters[0]?.title ?? null,
          feedItems: orderedHeadlines.length,
        },
      };
    },
    isUsable: (value) => Boolean(value.updatedAt),
  });

  return cached;
}

async function getIntelFeed(timeRange: WorldPulseTimeRange) {
  const [conflict, macro] = await Promise.all([
    safeResolve(
      () =>
        fetchGoogleNewsRss(
          `(war OR conflict OR missile OR strike OR attack OR troops OR ceasefire OR sanctions) ${timeWindowQualifier(
            timeRange
          )}`,
          "conflict"
        ),
      []
    ),
    safeResolve(
      () =>
        fetchGoogleNewsRss(
          `(oil OR tariffs OR tariff OR shipping OR inflation OR cyberattack OR semiconductor OR central bank) ${timeWindowQualifier(
            timeRange
          )}`,
          "macro"
        ),
      []
    ),
  ]);

  const deduped = dedupeHeadlines([...conflict, ...macro]);
  return deduped
    .map((item) => ({
      ...item,
      hotspotIds: inferHotspots(item.title, item.summary),
    }))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

async function fetchGoogleNewsRss(
  query: string,
  category: "conflict" | "macro"
): Promise<WorldPulseHeadline[]> {
  const url = new URL(GOOGLE_NEWS_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");

  const xml = await fetchText(url.toString());
  const root = parse(xml);
  const items = root.querySelectorAll("item");

  return items.slice(0, 24).map((item, index) => {
    const title = cleanHeadline(item.querySelector("title")?.textContent ?? "");
    const description = extractDescription(item.querySelector("description")?.textContent ?? "");
    const source = cleanHeadline(item.querySelector("source")?.textContent ?? "Global feed");
    const link = item.querySelector("link")?.textContent?.trim() ?? "#";
    const publishedAt = normalizeDate(item.querySelector("pubDate")?.textContent ?? "");

    return {
      id: `${category}:${publishedAt}:${index}:${slugify(title).slice(0, 24)}`,
      title,
      source,
      link,
      publishedAt,
      category,
      hotspotIds: [],
      summary: description || title,
    };
  });
}

async function getDisasterFeed(timeRange: WorldPulseTimeRange) {
  const xml = await fetchText(GDACS_RSS_URL);
  const root = parse(xml);
  const items = root.querySelectorAll("item");
  const cutoff = Date.now() - rangeToMs(timeRange);

  return items
    .map((item, index) => {
      const html = item.toString();
      const point = extractNamespacedTag(html, "georss:point");
      const [latText, lonText] = point.split(/\s+/);
      const lat = Number(latText);
      const lon = Number(lonText);
      const title = cleanHeadline(item.querySelector("title")?.textContent ?? "");
      const description = cleanHeadline(item.querySelector("description")?.textContent ?? "");
      const link = item.querySelector("link")?.textContent?.trim() ?? "#";
      const publishedAt = normalizeDate(item.querySelector("pubDate")?.textContent ?? "");
      const gdacsCode = cleanHeadline(extractNamespacedTag(html, "dc:subject"));
      const alert = description.match(/\b(red|orange|green)\b/i)?.[1]?.toLowerCase() as
        | "green"
        | "orange"
        | "red"
        | undefined;

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

      return {
        id: `${gdacsCode || "gdacs"}:${index}:${publishedAt}`,
        title,
        category: inferDisasterCategory(gdacsCode, title),
        country: inferCountryFromDisasterTitle(title),
        alertLevel: alert ?? "green",
        lat,
        lon,
        publishedAt,
        link,
        summary: description || title,
        severityLabel: inferDisasterSeverityLabel(title, description),
        severityValue: inferDisasterSeverityValue(title, description),
      } satisfies WorldPulseDisasterEvent;
    })
    .filter((item): item is WorldPulseDisasterEvent => Boolean(item))
    .filter((item) => new Date(item.publishedAt).getTime() >= cutoff)
    .sort((a, b) => disasterScore(b) - disasterScore(a))
    .slice(0, 20);
}

function buildHotspots(headlines: WorldPulseHeadline[]) {
  const buckets = new Map<string, WorldPulseHeadline[]>();

  for (const item of headlines) {
    for (const hotspotId of item.hotspotIds) {
      const group = buckets.get(hotspotId) ?? [];
      group.push(item);
      buckets.set(hotspotId, group);
    }
  }

  return HOTSPOTS.map((seed) => {
    const items = (buckets.get(seed.id) ?? []).sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    const score = computeHotspotScore(items);
    return {
      id: seed.id,
      name: seed.name,
      region: seed.region,
      country: seed.country,
      lat: seed.lat,
      lon: seed.lon,
      score,
      eventCount: items.length,
      severity: hotspotSeverity(score),
      latestAt: items[0]?.publishedAt ?? null,
      lead: items[0]?.title ?? `Watching ${seed.country} for fresh live signals.`,
      latestSource: items[0]?.source ?? null,
    } satisfies WorldPulseHotspot;
  })
    .filter((hotspot) => hotspot.eventCount > 0)
    .sort((a, b) => b.score - a.score);
}

function buildMarketMarkers(world: GlobalMarketData) {
  return world.quotes
    .map((quote) => {
      const coordinates = MARKET_COORDINATES[quote.symbol];
      if (!coordinates || !quote.country || !quote.region) return null;
      return {
        symbol: quote.symbol,
        name: quote.name,
        country: quote.country,
        region: quote.region,
        lat: coordinates.lat,
        lon: coordinates.lon,
        price: quote.price,
        changePct: quote.changePct,
        currency: quote.currency ?? null,
      };
    })
    .filter(
      (
        item
      ): item is WorldPulseData["marketMarkers"][number] => Boolean(item)
    )
    .sort(
      (a, b) =>
        Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0) ||
        (b.price ?? 0) - (a.price ?? 0)
    );
}

function buildMarketSnapshot(
  world: GlobalMarketData,
  commodities: GlobalMarketData,
  oil: GlobalMarketData,
  crypto: GlobalMarketData
): WorldPulseData["marketSnapshot"] {
  const brent = oil.quotes.find((quote) => quote.symbol === "BZ=F") ?? oil.quotes[0] ?? null;
  const gold =
    commodities.quotes.find((quote) => quote.symbol === "GC=F") ?? commodities.quotes[0] ?? null;
  const bitcoin =
    crypto.quotes.find((quote) => quote.symbol === "BTC") ??
    crypto.quotes.find((quote) => quote.name.toLowerCase().includes("bitcoin")) ??
    crypto.quotes[0] ??
    null;

  const tone =
    (world.summary.avgChangePct ?? 0) <= -0.35 ||
    (brent?.changePct ?? 0) >= 1.2 ||
    (gold?.changePct ?? 0) >= 1
      ? "risk-off"
      : (world.summary.avgChangePct ?? 0) >= 0.35
        ? "risk-on"
        : "balanced";

  const signals = [
    brent ? `${brent.name} ${formatSignedPercent(brent.changePct)} on the day` : "Brent crude reading unavailable",
    gold ? `Gold ${formatSignedPercent(gold.changePct)} as the safety read` : "Gold reading unavailable",
    bitcoin
      ? `Bitcoin ${formatSignedPercent(bitcoin.changePct)} around the risk appetite check`
      : "Bitcoin reading unavailable",
  ];

  return {
    averageMove: world.summary.avgChangePct ?? 0,
    best: world.summary.best,
    worst: world.summary.worst,
    brent,
    gold,
    bitcoin,
    tone,
    signals,
  };
}

function prioritizeHeadlinesForView(items: WorldPulseHeadline[], view: WorldPulseView) {
  if (view === "world") return items;

  return [...items].sort((a, b) => {
    const aMatch = a.hotspotIds.some((hotspotId) => hotspotInView(hotspotId, view)) ? 1 : 0;
    const bMatch = b.hotspotIds.some((hotspotId) => hotspotInView(hotspotId, view)) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

function dedupeHeadlines(items: WorldPulseHeadline[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = slugify(item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferHotspots(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase();
  return HOTSPOTS.filter((hotspot) =>
    hotspot.aliases.some((alias) => text.includes(alias.toLowerCase()))
  ).map((hotspot) => hotspot.id);
}

function computeHotspotScore(items: WorldPulseHeadline[]) {
  return items.reduce((score, item, index) => {
    const ageHours = Math.max(1, (Date.now() - new Date(item.publishedAt).getTime()) / 3_600_000);
    const recencyBoost = Math.max(4, 18 - ageHours);
    const headlineWeight = item.category === "conflict" ? 15 : 10;
    const topStoryBoost = index === 0 ? 10 : 0;
    return score + headlineWeight + recencyBoost + topStoryBoost;
  }, 0);
}

function hotspotSeverity(score: number): WorldPulseHotspot["severity"] {
  if (score >= 85) return "critical";
  if (score >= 55) return "high";
  if (score >= 28) return "elevated";
  return "watch";
}

function disasterScore(event: WorldPulseDisasterEvent) {
  const levelScore = event.alertLevel === "red" ? 90 : event.alertLevel === "orange" ? 60 : 30;
  const severity = event.severityValue ?? 0;
  return levelScore + Math.min(severity, 25);
}

function inferDisasterCategory(code: string, title: string) {
  if (/TC/i.test(code) || /cyclone|storm|hurricane|typhoon/i.test(title)) return "Storm";
  if (/WF/i.test(code) || /fire/i.test(title)) return "Wildfire";
  if (/FL/i.test(code) || /flood/i.test(title)) return "Flood";
  if (/VO/i.test(code) || /volcano/i.test(title)) return "Volcano";
  if (/DR/i.test(code) || /drought/i.test(title)) return "Drought";
  return "Earthquake";
}

function inferCountryFromDisasterTitle(title: string) {
  const match = title.match(/\bin ([A-Z][A-Za-z' -]+)$/);
  if (match?.[1]) return match[1].trim();
  const fallback = title.split(" in ").at(-1);
  return fallback?.trim() || "Global";
}

function inferDisasterSeverityLabel(title: string, description: string) {
  const text = `${title} ${description}`;
  const magnitude = text.match(/magnitude\s*([0-9.]+)m/i);
  if (magnitude?.[1]) return `Magnitude ${magnitude[1]}`;
  const population = text.match(/([0-9.,]+\s+(?:million|thousand))/i);
  if (population?.[1]) return `${population[1]} exposed`;
  const wind = text.match(/([0-9]+)\s*km\/h/i);
  if (wind?.[1]) return `${wind[1]} km/h winds`;
  return "Live GDACS alert";
}

function inferDisasterSeverityValue(title: string, description: string) {
  const magnitude = `${title} ${description}`.match(/magnitude\s*([0-9.]+)m/i);
  if (magnitude?.[1]) return Number(magnitude[1]);
  const exposedMillion = `${title} ${description}`.match(/([0-9.]+)\s+million/i);
  if (exposedMillion?.[1]) return Number(exposedMillion[1]) * 10;
  const exposedThousand = `${title} ${description}`.match(/([0-9.]+)\s+thousand/i);
  if (exposedThousand?.[1]) return Number(exposedThousand[1]) / 10;
  const wind = `${title} ${description}`.match(/([0-9]+)\s*km\/h/i);
  if (wind?.[1]) return Number(wind[1]) / 10;
  return null;
}

function timeWindowQualifier(range: WorldPulseTimeRange) {
  if (range === "24h") return "when:1d";
  if (range === "48h") return "when:2d";
  return "when:7d";
}

function rangeToMs(range: WorldPulseTimeRange) {
  if (range === "24h") return 24 * 60 * 60 * 1000;
  if (range === "48h") return 48 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function isWithinView(lon: number, lat: number, view: WorldPulseView) {
  if (view === "world") return true;
  const [[west, south], [east, north]] = VIEW_PRESETS[view].bounds;
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

function hotspotInView(hotspotId: string, view: WorldPulseView) {
  const hotspot = HOTSPOTS.find((item) => item.id === hotspotId);
  if (!hotspot) return false;
  return isWithinView(hotspot.lon, hotspot.lat, view);
}

async function safeResolve<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

async function safeMarketData(universe: MarketUniverse) {
  return safeResolve(() => getGlobalMarketData(universe), emptyMarketData(universe));
}

function emptyMarketData(universe: MarketUniverse): GlobalMarketData {
  const meta = getGlobalMarketMeta(universe);
  return {
    universe,
    title: meta.title,
    description: meta.description,
    sourceLabel: "Unavailable",
    sourceUrl: "",
    quotes: [],
    summary: {
      advancers: 0,
      decliners: 0,
      flat: 0,
      avgChangePct: 0,
      best: null,
      worst: null,
    },
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Stockli World Pulse/1.0",
      accept: "application/json, text/xml, application/xml, text/plain, */*",
    },
    next: { revalidate: WORLD_PULSE_TTL_SECONDS },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`World Pulse source failed with status ${response.status}.`);
  }
  return response.text();
}

function extractDescription(text: string) {
  return parse(text).textContent.replace(/\s+/g, " ").trim();
}

function extractNamespacedTag(html: string, tagName: string) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<${escapedTag}>([\\s\\S]*?)</${escapedTag}>`, "i"));
  return cleanHeadline(match?.[1] ?? "");
}

function cleanHeadline(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatSignedPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "flat";
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${Math.abs(value).toFixed(2)}%`;
}
