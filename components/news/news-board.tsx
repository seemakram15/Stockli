"use client";

import * as React from "react";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  RefreshCw,
  Globe2,
  Flame,
  TrendingUp,
  Shield,
  Leaf,
  ArrowRight,
  BarChart2,
  Radio,
  ChevronDown,
  Zap,
  Newspaper,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  NewsArticle,
  NewsCategory,
  NewsMode,
  PsxSentiment,
  WorldSource,
  NationalSource,
} from "@/lib/services/world-news";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ── Constants ─────────────────────────────────────────────────────────────────

const WORLD_SOURCES: WorldSource[]    = ["BBC", "Reuters", "Al Jazeera", "CNBC", "Guardian", "FT"];
const NATIONAL_SOURCES: NationalSource[] = ["ARY News", "The News", "Express Tribune", "The Nation", "Dawn"];

const SOURCE_COLORS: Record<string, string> = {
  BBC:          "bg-red-600 text-white",
  Reuters:      "bg-orange-500 text-white",
  "Al Jazeera": "bg-amber-600 text-white",
  CNBC:         "bg-blue-700 text-white",
  Guardian:     "bg-[#052962] text-white",
  FT:           "bg-[#FFF1E5] text-[#1a1a1a]",
  "ARY News":        "bg-green-700 text-white",
  "The News":        "bg-blue-600 text-white",
  "Express Tribune": "bg-red-700 text-white",
  "The Nation":      "bg-purple-700 text-white",
  Dawn:              "bg-slate-700 text-white",
};

type CatKey = NewsCategory | "all" | "climate";

const CAT_META: Record<CatKey, { label: string; icon: React.ReactNode; cls: string }> = {
  all:      { label: "All",       icon: <Globe2 className="size-3.5" />,         cls: "bg-primary/10 text-primary border-primary/20" },
  pakistan: { label: "Pakistan",  icon: <Flag className="size-3.5" />,           cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  economy:  { label: "Economy",   icon: <TrendingUp className="size-3.5" />,     cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  conflict: { label: "Conflicts", icon: <Shield className="size-3.5" />,         cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  energy:   { label: "Energy",    icon: <Zap className="size-3.5" />,            cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  markets:  { label: "Markets",   icon: <BarChart2 className="size-3.5" />,      cls: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  trade:    { label: "Trade",     icon: <ArrowRight className="size-3.5" />,     cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  politics: { label: "Politics",  icon: <AlertTriangle className="size-3.5" />,  cls: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  climate:  { label: "Climate",   icon: <Leaf className="size-3.5" />,           cls: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  general:  { label: "General",   icon: <Newspaper className="size-3.5" />,      cls: "bg-muted text-muted-foreground border-border" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TimeAgo({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState("");
  React.useEffect(() => { setLabel(timeAgo(iso)); }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SourceChip({ source }: { source: string }) {
  const cls = SOURCE_COLORS[source] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide", cls)}>
      {source}
    </span>
  );
}

function CatPill({ category }: { category: NewsCategory }) {
  const m = CAT_META[category] ?? CAT_META.general;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", m.cls)}>
      {m.icon}{m.label}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: NewsArticle["urgency"] }) {
  if (urgency === "breaking")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" />Breaking
      </span>
    );
  if (urgency === "high")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-orange-400">
        <span className="size-1.5 rounded-full bg-orange-400" />Developing
      </span>
    );
  return null;
}

function SafeImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [err, setErr] = React.useState(false);
  if (err) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      crossOrigin="anonymous"
      onError={() => setErr(true)}
    />
  );
}

function BreakingTicker({ articles }: { articles: NewsArticle[] }) {
  const items = articles.filter((a) => a.urgency === "breaking").slice(0, 8);
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5">
      <div className="flex shrink-0 items-center gap-2 border-r border-red-500/20 bg-red-600 px-3 py-2">
        <Radio className="size-3 animate-pulse text-white" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">Breaking</span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex gap-10 whitespace-nowrap py-2 pl-4"
          style={{ animation: "ticker 55s linear infinite" }}
        >
          {doubled.map((a, i) => (
            <a
              key={`${a.id}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-red-300 transition-colors hover:text-red-100"
            >
              <span className="size-1 shrink-0 rounded-full bg-red-400" />
              {a.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroCard({ article }: { article: NewsArticle }) {
  const [imgErr, setImgErr] = React.useState(false);
  const hasImg = !!article.imageUrl && !imgErr;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card shadow-xl transition-all hover:border-primary/30 sm:min-h-[360px]"
    >
      {article.imageUrl && !imgErr ? (
        <>
          <img
            src={article.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            onError={() => setImgErr(true)}
            className="absolute inset-0 h-full w-full object-cover opacity-45 transition-opacity group-hover:opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-card via-muted/20 to-card" />
      )}

      <div className={cn("relative p-5 sm:p-6", !hasImg && "pt-8")}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={article.urgency} />
          <SentimentBadge sentiment={article.psxSentiment} />
          <CatPill category={article.category} />
          <SourceChip source={article.source} />
        </div>
        <h2 className="text-lg font-bold leading-snug text-foreground group-hover:text-primary sm:text-xl">
          {article.title}
        </h2>
        {article.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{article.description}</p>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3" />
          <TimeAgo iso={article.publishedAt} />
          <ExternalLink className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-60" />
        </div>
      </div>
    </a>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const [imgErr, setImgErr] = React.useState(false);
  const hasImg = !!article.imageUrl && !imgErr;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
    >
      {article.imageUrl && !imgErr ? (
        <div className="relative h-40 shrink-0 overflow-hidden bg-muted">
          <img
            src={article.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            loading="lazy"
            onError={() => setImgErr(true)}
            className="h-full w-full object-cover opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-95"
          />
          {article.urgency !== "normal" && (
            <div className="absolute left-2 top-2">
              <UrgencyBadge urgency={article.urgency} />
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {!hasImg && <UrgencyBadge urgency={article.urgency} />}
          <SourceChip source={article.source} />
          <CatPill category={article.category} />
          <SentimentBadge sentiment={article.psxSentiment} />
        </div>
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
          {article.title}
        </h3>
        {article.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {article.description}
          </p>
        )}
        {article.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {article.tags.map((t) => (
              <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          <TimeAgo iso={article.publishedAt} />
          <ExternalLink className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-50" />
        </div>
      </div>
    </a>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }: { sentiment: PsxSentiment | null }) {
  if (!sentiment) return null;
  if (sentiment === "positive")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
        <span className="size-1.5 rounded-full bg-emerald-400" />PSX +ve
      </span>
    );
  if (sentiment === "negative")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
        <span className="size-1.5 rounded-full bg-red-400" />PSX −ve
      </span>
    );
  return null;
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: NewsMode;
  onChange: (m: NewsMode) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1">
      <button
        onClick={() => onChange("world")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
          mode === "world"
            ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Globe2 className="size-3.5" />
        World
      </button>
      <button
        onClick={() => onChange("national")}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
          mode === "national"
            ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Flag className="size-3.5" />
        National
      </button>
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────

export function NewsBoard({
  worldArticles,
  nationalArticles,
}: {
  worldArticles: NewsArticle[];
  nationalArticles: NewsArticle[];
}) {
  const [mode, setMode]           = React.useState<NewsMode>("world");
  const [worldData, setWorldData] = React.useState(worldArticles);
  const [natData, setNatData]     = React.useState(nationalArticles);
  const [category, setCategory]   = React.useState<CatKey>("all");
  const [source, setSource]       = React.useState<string>("all");
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastRefresh, setLastRefresh] = React.useState<Date | null>(null);

  React.useEffect(() => { setLastRefresh(new Date()); }, []);

  const articles = mode === "world" ? worldData : natData;
  const sources  = mode === "world" ? WORLD_SOURCES : NATIONAL_SOURCES;

  // Reset filters on mode change
  React.useEffect(() => { setCategory("all"); setSource("all"); }, [mode]);

  async function refresh() {
    setRefreshing(true);
    try {
      const [wRes, nRes] = await Promise.all([
        fetch("/api/news?mode=world",    { cache: "no-store" }),
        fetch("/api/news?mode=national", { cache: "no-store" }),
      ]);
      if (wRes.ok) setWorldData(await wRes.json());
      if (nRes.ok) setNatData(await nRes.json());
      setLastRefresh(new Date());
    } finally { setRefreshing(false); }
  }

  React.useEffect(() => {
    const id = setInterval(refresh, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = articles.filter((a) => {
    if (category !== "all" && a.category !== category) return false;
    if (source   !== "all" && a.source   !== source)   return false;
    return true;
  });

  const hero      = filtered[0];
  const secondary = filtered.slice(1, 4);
  const rest      = filtered.slice(4);

  const activeCats: CatKey[] = ["all", "pakistan", "economy", "conflict", "energy", "markets", "trade", "politics", "general"];

  return (
    <div className="space-y-5 p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Newspaper className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Latest News</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "world" ? "Global market impact · max 12h old" : "Pakistan national news · max 12h old"}
              {" · "}{articles.length} stories
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <div className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground sm:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              {timeAgo(lastRefresh.toISOString())}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Mode toggle */}
      <ModeToggle mode={mode} onChange={setMode} />

      {/* Breaking ticker */}
      <BreakingTicker articles={articles} />

      {/* Filters */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Category tabs */}
        <div className="flex flex-1 gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {activeCats.map((cat) => {
            const cnt = cat === "all"
              ? articles.length
              : articles.filter((a) => a.category === cat).length;
            if (cnt === 0 && cat !== "all") return null;
            const m = CAT_META[cat];
            const active = category === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  active
                    ? cn(m.cls, "shadow-sm")
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {m.icon}
                {m.label}
                <span className={cn("rounded-full px-1 text-[10px] font-bold", active ? "bg-white/20" : "bg-muted text-muted-foreground")}>
                  {cnt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Channel dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
              <Radio className="size-3.5" />
              {source === "all" ? "All Channels" : source}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {mode === "world" ? "World Channels" : "National Channels"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setSource("all")}
              className={cn(source === "all" && "text-primary font-medium")}
            >
              All Channels
            </DropdownMenuItem>
            {sources.map((s) => {
              const cnt = articles.filter((a) => a.source === s).length;
              if (cnt === 0) return null;
              return (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setSource(s)}
                  className={cn("justify-between", source === s && "text-primary font-medium")}
                >
                  <span>{s}</span>
                  <span className="text-xs text-muted-foreground">{cnt}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Globe2 className="mb-3 size-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No stories match this filter</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Try a different category or channel · Stories update every 15 min
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Hero + secondary */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {hero && (
              <div className="lg:col-span-2">
                <HeroCard article={hero} />
              </div>
            )}
            {secondary.length > 0 && (
              <div className="flex flex-col gap-4">
                {secondary.map((a) => <NewsCard key={a.id} article={a} />)}
              </div>
            )}
          </div>

          {/* Rest grid */}
          {rest.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  More Stories
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rest.map((a) => <NewsCard key={a.id} article={a} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="rounded-xl border border-border bg-card/50 p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {mode === "world" ? "World Sources" : "National Sources"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {sources.map((s) => <SourceChip key={s} source={s} />)}
          <span className="text-[11px] text-muted-foreground">
            · Max 12h old · Refreshes every 15 min
          </span>
        </div>
      </div>

      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
