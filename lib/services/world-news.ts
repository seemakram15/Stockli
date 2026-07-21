import { classifyPakistanImpact } from "@/lib/services/news-sentiment-ai";

export type NewsCategory =
  | "economy"
  | "conflict"
  | "energy"
  | "politics"
  | "markets"
  | "trade"
  | "pakistan"
  | "general";

export type NewsMode = "world" | "national";

export type WorldSource = "BBC" | "Reuters" | "Al Jazeera" | "CNBC" | "Guardian" | "FT";
export type NationalSource = "ARY News" | "The News" | "Express Tribune" | "The Nation" | "Dawn";
export type AnySource = WorldSource | NationalSource;

export type PsxSentiment = "positive" | "negative";

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: AnySource;
  publishedAt: string;
  category: NewsCategory;
  urgency: "breaking" | "high" | "normal";
  tags: string[];
  mode: NewsMode;
  psxSentiment: PsxSentiment | null;
}

// ── Feed definitions ─────────────────────────────────────────────────────────

const WORLD_FEEDS: { name: WorldSource; url: string }[] = [
  { name: "BBC",        url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "BBC",        url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { name: "Reuters",    url: "https://feeds.reuters.com/reuters/worldNews" },
  { name: "Reuters",    url: "https://feeds.reuters.com/reuters/businessNews" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "CNBC",       url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { name: "CNBC",       url: "https://www.cnbc.com/id/20910258/device/rss/rss.html" },
  { name: "Guardian",   url: "https://www.theguardian.com/world/rss" },
  { name: "Guardian",   url: "https://www.theguardian.com/business/rss" },
  { name: "FT",         url: "https://www.ft.com/world?format=rss" },
];

const NATIONAL_FEEDS: { name: NationalSource; url: string }[] = [
  { name: "ARY News",       url: "https://arynews.tv/feed/" },
  { name: "The News",       url: "https://www.thenews.com.pk/rss/1/1" },
  { name: "Express Tribune", url: "https://tribune.com.pk/feed/rss" },
  { name: "The Nation",     url: "https://nation.com.pk/rss/latest" },
  { name: "Dawn",           url: "https://www.dawn.com/feeds/home" },
];

// ── Keyword lists ─────────────────────────────────────────────────────────────

const GLOBAL_MARKET_KW = [
  "federal reserve", "fed rate", "interest rate", "rate hike", "rate cut",
  "inflation", "recession", "gdp", "stagflation", "world bank", "imf",
  "debt crisis", "economic crisis", "currency crisis", "dollar index",
  "stock market", "wall street", "market crash", "market rally",
  "commodity", "gold price", "oil price", "crude oil", "brent", "wti",
  "opec", "natural gas", "lng", "energy crisis",
  "war", "ceasefire", "sanctions", "embargo", "nuclear",
  "ukraine", "russia", "middle east", "iran", "israel", "hamas", "nato",
  "trade war", "tariff", "supply chain", "china gdp",
  "bitcoin", "crypto crash", "wheat", "food crisis", "pakistan",
];

const BREAKING_KW = ["breaking", "urgent", "alert", "just in", "developing", "emergency", "explosion", "collapse"];
const HIGH_KW     = ["oil price", "rate hike", "rate cut", "fed decision", "opec", "sanctions", "nuclear", "missile", "ceasefire", "default", "market crash", "recession", "coup", "pakistan", "psx", "kse"];

// ── Text cleaning ─────────────────────────────────────────────────────────────

function cleanText(raw: string, maxLen = 350): string {
  let s = raw;
  // Remove CDATA wrappers
  s = s.replace(/<!\[CDATA\[|\]\]>/g, "");
  // Decode entities BEFORE stripping tags (they may be double-encoded)
  s = decodeEntities(s);
  // Strip all HTML tags
  s = s.replace(/<[^>]*>/g, " ");
  // Decode entities again (some feeds double-encode)
  s = decodeEntities(s);
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, maxLen);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g,   "&")
    .replace(/&lt;/g,    "<")
    .replace(/&gt;/g,    ">")
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    .replace(/&apos;/g,  "'")
    .replace(/&nbsp;/g,  " ")
    .replace(/&shy;/g,   "")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractField(block: string, tag: string): string {
  // Try CDATA first, then plain
  const cdataRe = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i");
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  return (block.match(cdataRe) ?? block.match(plainRe))?.[1]?.trim() ?? "";
}

function decodeUrl(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();
}

function extractImage(block: string): string | null {
  const patterns = [
    /<media:thumbnail[^>]+url=["']([^"'>]+)["']/i,
    /<media:content[^>]+url=["']([^"'>]+\.(jpg|jpeg|png|webp)[^"'>]*)["']/i,
    /<enclosure[^>]+url=["']([^"'>]+\.(jpg|jpeg|png|webp)[^"'>]*)["']/i,
    /<image:url[^>]*>([^<]+)<\/image:url>/i,
  ];
  for (const p of patterns) {
    const m = block.match(p);
    if (m?.[1]) return decodeUrl(m[1]);
  }
  const content = extractField(block, "content:encoded") || extractField(block, "description");
  const imgM = content.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  if (imgM?.[1]) return decodeUrl(imgM[1]);
  return null;
}

function extractLink(block: string): string {
  // <link> after <![CDATA or plain, or atom-style
  const raw = extractField(block, "link");
  const cleaned = raw.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  if (cleaned.startsWith("http")) return cleaned;
  // Some feeds put the link as text node without closing tag
  const m = block.match(/<link>([^<]+)<\/link>/);
  if (m?.[1]) return m[1].trim();
  const m2 = block.match(/href=["']([^"']+)["']/i);
  return m2?.[1] ?? "";
}

// ── Categorisation ────────────────────────────────────────────────────────────

function categorize(text: string): NewsCategory {
  const t = text.toLowerCase();
  if (/pakistan|psx|kse|karachi|lahore|islamabad|rupee|pkr|sbp|cpec/.test(t)) return "pakistan";
  if (/war|conflict|invasion|airstrike|ceasefire|military|nato|attack|nuclear|missile|troops/.test(t)) return "conflict";
  if (/oil|gas|energy|opec|crude|petroleum|lng|fuel/.test(t)) return "energy";
  if (/federal reserve|fed rate|interest rate|inflation|recession|gdp|imf|world bank|debt|currency|dollar|economic/.test(t)) return "economy";
  if (/stock market|wall street|commodity|gold|bitcoin|crypto|bear|bull|equity/.test(t)) return "markets";
  if (/trade|tariff|supply chain|export|import|embargo/.test(t)) return "trade";
  if (/election|president|minister|government|parliament|coup|protest/.test(t)) return "politics";
  return "general";
}

function urgencyOf(title: string, desc: string): NewsArticle["urgency"] {
  const t = (title + " " + desc).toLowerCase();
  if (BREAKING_KW.some((k) => t.includes(k))) return "breaking";
  if (HIGH_KW.some((k) => t.includes(k))) return "high";
  return "normal";
}

function isGloballyRelevant(text: string): boolean {
  const t = text.toLowerCase();
  return GLOBAL_MARKET_KW.some((k) => t.includes(k));
}


function extractTags(text: string): string[] {
  const t = text.toLowerCase();
  const map: Record<string, string> = {
    pakistan: "Pakistan", china: "China", ukraine: "Ukraine", russia: "Russia",
    iran: "Iran", israel: "Israel", "oil price": "Oil", opec: "OPEC",
    "federal reserve": "Fed", inflation: "Inflation", "trade war": "Trade War",
    imf: "IMF", gold: "Gold", recession: "Recession", sanctions: "Sanctions",
    nuclear: "Nuclear", ceasefire: "Ceasefire", nato: "NATO",
    bitcoin: "Bitcoin", psx: "PSX", kse: "KSE", cpec: "CPEC",
  };
  return Object.entries(map).filter(([k]) => t.includes(k)).map(([, v]) => v).slice(0, 4);
}

function within12h(dateStr: string): boolean {
  try {
    const ms = Date.now() - new Date(dateStr).getTime();
    return ms >= 0 && ms < 12 * 60 * 60 * 1000;
  } catch { return false; }
}

function makeId(title: string, source: string): string {
  return `${source}-${title}`.replace(/\W+/g, "-").toLowerCase().slice(0, 72);
}

// ── Feed fetcher ──────────────────────────────────────────────────────────────

async function fetchFeed<S extends AnySource>(
  feed: { name: S; url: string },
  mode: NewsMode,
  relevanceFilter: boolean,
): Promise<NewsArticle[]> {
  try {
    const res = await fetch(feed.url, {
      next: { revalidate: 900 },
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Stockli/1.0)" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
    const articles: NewsArticle[] = [];

    for (const block of blocks) {
      const title = cleanText(extractField(block, "title"), 200);
      const rawDesc = extractField(block, "description");
      const description = cleanText(rawDesc, 300);
      const link = extractLink(block);
      const pubDate = extractField(block, "pubDate") || extractField(block, "dc:date");

      if (!title || !link) continue;
      if (pubDate && !within12h(pubDate)) continue;

      const fullText = `${title} ${description}`;
      if (relevanceFilter && !isGloballyRelevant(fullText)) continue;

      articles.push({
        id: makeId(title, feed.name),
        title,
        description,
        url: link.startsWith("http") ? link : `https://${link}`,
        imageUrl: extractImage(block),
        source: feed.name,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        category: categorize(fullText),
        urgency: urgencyOf(title, description),
        tags: extractTags(fullText),
        mode,
        psxSentiment: null,
      });
    }
    return articles;
  } catch { return []; }
}

// ── Dedup + sort ──────────────────────────────────────────────────────────────

function mergeAndSort(arrays: NewsArticle[][]): NewsArticle[] {
  const seen = new Set<string>();
  const all: NewsArticle[] = [];
  for (const list of arrays) {
    for (const a of list) {
      const key = a.title.toLowerCase().slice(0, 80);
      if (!seen.has(key)) { seen.add(key); all.push(a); }
    }
  }
  const rank = { breaking: 3, high: 2, normal: 1 } as const;
  return all.sort((a, b) => {
    const aPak = a.category === "pakistan" ? 1 : 0;
    const bPak = b.category === "pakistan" ? 1 : 0;
    if (bPak !== aPak) return bPak - aPak;
    const u = rank[b.urgency] - rank[a.urgency];
    if (u !== 0) return u;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

// ── AI sentiment enrichment ───────────────────────────────────────────────────

async function enrichWithSentiment(articles: NewsArticle[]): Promise<NewsArticle[]> {
  const map = await classifyPakistanImpact(
    articles.map((a) => ({ id: a.id, title: a.title, description: a.description }))
  );
  return articles.map((a) => ({
    ...a,
    psxSentiment: map[a.id] ?? null,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchWorldNews(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    WORLD_FEEDS.map((f) => fetchFeed(f, "world", true))
  );
  const merged = mergeAndSort(results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<NewsArticle[]>).value));
  return enrichWithSentiment(merged);
}

export async function fetchNationalNews(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    NATIONAL_FEEDS.map((f) => fetchFeed(f, "national", false))
  );
  const merged = mergeAndSort(results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<NewsArticle[]>).value));
  return enrichWithSentiment(merged);
}
