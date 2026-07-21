export type NewsCategory =
  | "economy"
  | "conflict"
  | "energy"
  | "politics"
  | "markets"
  | "trade"
  | "climate"
  | "breaking";

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: string;
  sourceLogo: string;
  publishedAt: string;
  category: NewsCategory;
  urgency: "breaking" | "high" | "normal";
  tags: string[];
}

interface RssItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  enclosure?: string;
  mediaUrl?: string;
  content?: string;
}

const SOURCES = [
  {
    name: "BBC World",
    logo: "BBC",
    color: "#BB1919",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
  },
  {
    name: "BBC Business",
    logo: "BBC",
    color: "#BB1919",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
  },
  {
    name: "Reuters",
    logo: "Reuters",
    color: "#FF8000",
    url: "https://feeds.reuters.com/reuters/worldNews",
  },
  {
    name: "Reuters Business",
    logo: "Reuters",
    color: "#FF8000",
    url: "https://feeds.reuters.com/reuters/businessNews",
  },
  {
    name: "Al Jazeera",
    logo: "Al Jazeera",
    color: "#C8A951",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    name: "CNBC",
    logo: "CNBC",
    color: "#003087",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  },
  {
    name: "CNBC Economy",
    logo: "CNBC",
    color: "#003087",
    url: "https://www.cnbc.com/id/20910258/device/rss/rss.html",
  },
  {
    name: "Financial Times",
    logo: "FT",
    color: "#FFF1E5",
    url: "https://www.ft.com/world?format=rss",
  },
  {
    name: "The Guardian",
    logo: "Guardian",
    color: "#052962",
    url: "https://www.theguardian.com/world/rss",
  },
] as const;

const PAKISTAN_KEYWORDS = [
  "pakistan", "psx", "kse", "karachi stock", "pakistani rupee", "pkr",
  "imf pakistan", "sbp", "state bank of pakistan",
];

const GLOBAL_IMPACT_KEYWORDS = [
  // Economy
  "federal reserve", "fed rate", "interest rate", "inflation", "recession",
  "gdp", "world bank", "imf", "debt crisis", "economic crisis", "stagflation",
  "dollar", "currency war", "emerging market",
  // Conflicts
  "war", "conflict", "invasion", "airstrike", "ceasefire", "peace talks",
  "ukraine", "russia", "middle east", "iran", "israel", "gaza", "hamas",
  "hezbollah", "nato", "sanction", "nuclear",
  // Energy
  "oil price", "crude oil", "opec", "natural gas", "energy crisis",
  "brent crude", "wti", "petroleum", "lng",
  // Trade / Geopolitics
  "china", "trade war", "tariff", "supply chain", "belt and road",
  "cpec", "asia", "south asia", "indo-pakistan",
  // Markets
  "stock market", "market crash", "wall street", "commodity", "gold price",
  "bitcoin", "crypto", "bear market", "bull market",
  // Climate / Disaster
  "flood", "earthquake", "climate", "drought", "food crisis", "wheat",
];

const BREAKING_KEYWORDS = [
  "breaking", "urgent", "alert", "just in", "developing",
  "war declared", "assassination", "crash", "explosion", "collapse",
];

const HIGH_URGENCY_KEYWORDS = [
  "sanctions", "oil price", "rate hike", "rate cut", "fed decision",
  "pakistan", "cpec", "imf deal", "default", "ceasefire", "attack",
  "nuclear", "missile",
];

function categorize(text: string): NewsCategory {
  const t = text.toLowerCase();
  if (/war|conflict|invasion|airstrike|ceasefire|military|nato|attack|sanction|nuclear|missile|troops/.test(t)) return "conflict";
  if (/oil|gas|energy|opec|crude|petroleum|lng|fuel/.test(t)) return "energy";
  if (/federal reserve|fed rate|interest rate|inflation|recession|gdp|imf|world bank|debt|currency|dollar|economic/.test(t)) return "economy";
  if (/stock market|wall street|commodity|gold|bitcoin|crypto|bear|bull|equity|shares/.test(t)) return "markets";
  if (/trade|tariff|supply chain|export|import|sanction/.test(t)) return "trade";
  if (/election|president|minister|government|parliament|political|coup|protest/.test(t)) return "politics";
  if (/climate|flood|earthquake|drought|disaster|food crisis|wheat/.test(t)) return "climate";
  return "economy";
}

function urgencyOf(text: string): NewsArticle["urgency"] {
  const t = text.toLowerCase();
  if (BREAKING_KEYWORDS.some((kw) => t.includes(kw))) return "breaking";
  if (HIGH_URGENCY_KEYWORDS.some((kw) => t.includes(kw))) return "high";
  return "normal";
}

function isRelevant(text: string): boolean {
  const t = text.toLowerCase();
  return (
    PAKISTAN_KEYWORDS.some((kw) => t.includes(kw)) ||
    GLOBAL_IMPACT_KEYWORDS.some((kw) => t.includes(kw))
  );
}

function extractTags(text: string): string[] {
  const t = text.toLowerCase();
  const found: string[] = [];
  const tagMap: Record<string, string> = {
    pakistan: "Pakistan", china: "China", ukraine: "Ukraine", russia: "Russia",
    iran: "Iran", israel: "Israel", "oil price": "Oil", opec: "OPEC",
    "federal reserve": "Fed", inflation: "Inflation", "trade war": "Trade War",
    cpec: "CPEC", imf: "IMF", gold: "Gold", recession: "Recession",
    sanctions: "Sanctions", nuclear: "Nuclear", war: "War",
    ceasefire: "Ceasefire", "energy crisis": "Energy", nato: "NATO",
  };
  for (const [kw, tag] of Object.entries(tagMap)) {
    if (t.includes(kw)) found.push(tag);
  }
  return found.slice(0, 4);
}

function extractImage(item: RssItem): string | null {
  if (item.mediaUrl) return item.mediaUrl;
  if (item.enclosure) return item.enclosure;
  if (item.content) {
    const m = item.content.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/i);
    if (m) return m[0];
  }
  return null;
}

function slug(title: string, source: string): string {
  return `${source}-${title}`.replace(/\W+/g, "-").toLowerCase().slice(0, 64);
}

async function fetchFeed(source: (typeof SOURCES)[number]): Promise<NewsArticle[]> {
  try {
    const res = await fetch(source.url, {
      next: { revalidate: 900 },
      headers: { "User-Agent": "Stockli/1.0 (news aggregator)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: RssItem[] = [];
    const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];

    for (const block of itemBlocks) {
      const get = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
          ?? block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
        return m?.[1]?.trim() ?? "";
      };

      const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      const mediaMatch = block.match(/<media:(?:thumbnail|content)[^>]+url=["']([^"']+)["']/i);

      items.push({
        title: get("title"),
        description: get("description"),
        link: get("link").replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
        pubDate: get("pubDate"),
        enclosure: enclosureMatch?.[1],
        mediaUrl: mediaMatch?.[1],
        content: get("content:encoded") || get("content"),
      });
    }

    const articles: NewsArticle[] = [];
    for (const item of items) {
      const text = `${item.title ?? ""} ${item.description ?? ""}`;
      if (!isRelevant(text)) continue;

      articles.push({
        id: slug(item.title ?? "", source.name),
        title: item.title ?? "Untitled",
        description: (item.description ?? "").replace(/<[^>]+>/g, "").slice(0, 280),
        url: item.link ?? "#",
        imageUrl: extractImage(item),
        source: source.name,
        sourceLogo: source.logo,
        publishedAt: item.pubDate ?? new Date().toISOString(),
        category: categorize(text),
        urgency: urgencyOf(text),
        tags: extractTags(text),
      });
    }
    return articles;
  } catch {
    return [];
  }
}

export async function fetchWorldNews(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(SOURCES.map(fetchFeed));
  const all: NewsArticle[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const a of r.value) {
        const key = a.title.toLowerCase().slice(0, 60);
        if (!seen.has(key)) {
          seen.add(key);
          all.push(a);
        }
      }
    }
  }

  return all.sort((a, b) => {
    const urgencyScore = { breaking: 3, high: 2, normal: 1 };
    const uDiff = urgencyScore[b.urgency] - urgencyScore[a.urgency];
    if (uDiff !== 0) return uDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}
