"use client";

import * as React from "react";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Filter,
  RefreshCw,
  Zap,
  Globe2,
  Flame,
  TrendingUp,
  Zap as Energy,
  Shield,
  Leaf,
  ArrowRight,
  BarChart2,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NewsArticle, NewsCategory } from "@/lib/services/world-news";

const CATEGORY_META: Record<
  NewsCategory | "all",
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  all:      { label: "All News",  icon: <Globe2 className="size-3.5" />,     color: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/20" },
  breaking: { label: "Breaking",  icon: <Zap className="size-3.5" />,         color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
  economy:  { label: "Economy",   icon: <TrendingUp className="size-3.5" />,  color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20" },
  conflict: { label: "Conflicts", icon: <Shield className="size-3.5" />,      color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  energy:   { label: "Energy",    icon: <Energy className="size-3.5" />,      color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  markets:  { label: "Markets",   icon: <BarChart2 className="size-3.5" />,   color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  trade:    { label: "Trade",     icon: <ArrowRight className="size-3.5" />,  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  politics: { label: "Politics",  icon: <Flame className="size-3.5" />,       color: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/20" },
  climate:  { label: "Climate",   icon: <Leaf className="size-3.5" />,        color: "text-teal-400",   bg: "bg-teal-500/10 border-teal-500/20" },
};

const SOURCE_COLORS: Record<string, string> = {
  BBC:        "bg-red-600",
  Reuters:    "bg-orange-500",
  "Al Jazeera": "bg-amber-600",
  CNBC:       "bg-blue-700",
  FT:         "bg-[#FFF1E5] text-[#333]",
  Guardian:   "bg-[#052962]",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SourceBadge({ source }: { source: string }) {
  const cls = SOURCE_COLORS[source] ?? "bg-slate-700";
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white", cls)}>
      {source}
    </span>
  );
}

function UrgencyDot({ urgency }: { urgency: NewsArticle["urgency"] }) {
  if (urgency === "breaking") return <span className="inline-block size-2 animate-pulse rounded-full bg-red-500" />;
  if (urgency === "high") return <span className="inline-block size-2 rounded-full bg-orange-400" />;
  return null;
}

function CategoryPill({ category }: { category: NewsCategory }) {
  const m = CATEGORY_META[category];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", m.color, m.bg)}>
      {m.icon}{m.label}
    </span>
  );
}

function BreakingTicker({ articles }: { articles: NewsArticle[] }) {
  const breaking = articles.filter((a) => a.urgency === "breaking").slice(0, 6);
  if (breaking.length === 0) return null;
  const items = [...breaking, ...breaking];

  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-red-500/30 bg-red-500/5">
      <div className="flex shrink-0 items-center gap-2 border-r border-red-500/30 bg-red-600 px-4 py-2.5">
        <Radio className="size-3.5 animate-pulse text-white" />
        <span className="text-xs font-bold uppercase tracking-widest text-white">Breaking</span>
      </div>
      <div className="relative flex-1 overflow-hidden py-2.5">
        <div
          className="flex gap-12 whitespace-nowrap"
          style={{ animation: "marquee 40s linear infinite" }}
        >
          {items.map((a, i) => (
            <a
              key={`${a.id}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-red-300 hover:text-red-100"
            >
              <span className="size-1.5 rounded-full bg-red-400" />
              {a.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroCard({ article }: { article: NewsArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex min-h-[320px] flex-col justify-end overflow-hidden rounded-2xl border border-white/5 bg-slate-800/60 shadow-2xl transition-transform hover:scale-[1.01] sm:min-h-[400px]"
    >
      {article.imageUrl ? (
        <>
          <img
            src={article.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-50 transition-opacity group-hover:opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      )}
      <div className="relative p-5 sm:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {article.urgency !== "normal" && (
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest",
              article.urgency === "breaking"
                ? "bg-red-600 text-white"
                : "bg-orange-500/90 text-white"
            )}>
              <span className="size-1.5 animate-pulse rounded-full bg-white" />
              {article.urgency === "breaking" ? "Breaking" : "Developing"}
            </span>
          )}
          <CategoryPill category={article.category} />
          <SourceBadge source={article.sourceLogo} />
        </div>
        <h2 className="text-xl font-bold leading-snug text-white group-hover:text-sky-200 sm:text-2xl">
          {article.title}
        </h2>
        {article.description && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-300">{article.description}</p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <Clock className="size-3.5 text-slate-400" />
          <span className="text-xs text-slate-400">{timeAgo(article.publishedAt)}</span>
          <ExternalLink className="ml-auto size-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </a>
  );
}

function NewsCard({ article, featured }: { article: NewsArticle; featured?: boolean }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-white/5 bg-slate-800/40 shadow-md backdrop-blur-sm transition-all hover:border-white/10 hover:bg-slate-800/60 hover:shadow-xl",
        featured && "sm:flex-row"
      )}
    >
      {article.imageUrl && (
        <div className={cn(
          "relative overflow-hidden bg-slate-700",
          featured ? "h-44 sm:h-auto sm:w-48 sm:shrink-0" : "h-40"
        )}>
          <img
            src={article.imageUrl}
            alt=""
            className="h-full w-full object-cover opacity-70 transition-all duration-500 group-hover:scale-105 group-hover:opacity-90"
          />
          {article.urgency !== "normal" && (
            <span className={cn(
              "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
              article.urgency === "breaking" ? "bg-red-600 text-white" : "bg-orange-500 text-white"
            )}>
              <span className="size-1 animate-pulse rounded-full bg-white" />
              {article.urgency === "breaking" ? "Breaking" : "High"}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <UrgencyDot urgency={article.urgency} />
          <SourceBadge source={article.sourceLogo} />
          <CategoryPill category={article.category} />
        </div>
        <h3 className={cn(
          "font-semibold leading-snug text-slate-100 group-hover:text-white",
          featured ? "text-base sm:text-lg" : "text-sm"
        )}>
          {article.title}
        </h3>
        {article.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
            {article.description}
          </p>
        )}
        {article.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {article.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="size-3" />
          {timeAgo(article.publishedAt)}
        </div>
      </div>
    </a>
  );
}

function EmptyState({ category }: { category: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <Globe2 className="mb-4 size-12 text-slate-600" />
      <p className="text-base font-medium text-slate-400">No {category} news right now</p>
      <p className="mt-1 text-sm text-slate-600">Articles refresh every 15 minutes</p>
    </div>
  );
}

export function NewsBoard({ initialArticles }: { initialArticles: NewsArticle[] }) {
  const [articles, setArticles] = React.useState(initialArticles);
  const [activeCategory, setActiveCategory] = React.useState<NewsCategory | "all">("all");
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState(new Date());

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (res.ok) {
        const data: NewsArticle[] = await res.json();
        setArticles(data);
        setLastRefresh(new Date());
      }
    } finally {
      setRefreshing(false);
    }
  }

  React.useEffect(() => {
    const id = setInterval(refresh, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = activeCategory === "all"
    ? articles
    : activeCategory === "breaking"
    ? articles.filter((a) => a.urgency === "breaking")
    : articles.filter((a) => a.category === activeCategory);

  const hero = filtered[0];
  const secondary = filtered.slice(1, 4);
  const rest = filtered.slice(4);

  const breakingCount = articles.filter((a) => a.urgency === "breaking").length;
  const categories: (NewsCategory | "all")[] = ["all", "breaking", "economy", "conflict", "energy", "markets", "trade", "politics", "climate"];

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg">
              <Globe2 className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">World News</h1>
              <p className="text-sm text-slate-400">Impact on Pakistan stock market · live updates</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-800/60 px-3 py-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-400">
              {articles.length} stories · updated {timeAgo(lastRefresh.toISOString())}
            </span>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-700/60 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Breaking ticker */}
      <BreakingTicker articles={articles} />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const m = CATEGORY_META[cat];
          const isActive = activeCategory === cat;
          const count = cat === "all" ? articles.length
            : cat === "breaking" ? breakingCount
            : articles.filter((a) => a.category === cat).length;
          if (count === 0 && cat !== "all") return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                isActive
                  ? cn(m.bg, m.color, "border-current shadow-md")
                  : "border-white/5 bg-slate-800/40 text-slate-400 hover:border-white/10 hover:text-slate-200"
              )}
            >
              {m.icon}
              {m.label}
              {count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-bold",
                  isActive ? "bg-white/20 text-white" : "bg-slate-700 text-slate-400"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState category={activeCategory} />
      ) : (
        <div className="space-y-6">
          {/* Hero + secondary grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {hero && (
              <div className="lg:col-span-2">
                <HeroCard article={hero} />
              </div>
            )}
            {secondary.length > 0 && (
              <div className="flex flex-col gap-4">
                {secondary.map((a) => (
                  <NewsCard key={a.id} article={a} />
                ))}
              </div>
            )}
          </div>

          {/* Rest of articles */}
          {rest.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">More Stories</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rest.map((a, i) => (
                  <NewsCard key={a.id} article={a} featured={i < 2} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Sources footer */}
      <div className="rounded-xl border border-white/5 bg-slate-800/30 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Sources</p>
        <div className="flex flex-wrap gap-2">
          {["BBC", "Reuters", "Al Jazeera", "CNBC", "FT", "Guardian"].map((s) => (
            <SourceBadge key={s} source={s} />
          ))}
          <span className="text-xs text-slate-600">· Filtered for Pakistan market relevance · Refreshes every 15 min</span>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
