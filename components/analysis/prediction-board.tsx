"use client";

import * as React from "react";
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, Activity,
  BarChart2, Globe2, Newspaper, Layers3, Gauge, CandlestickChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PsxPredictionPage, PsxSignal, PsxSignalGroup, IndexAnalysis, SectorOutlook,
} from "@/lib/services/psx-prediction";

const SIGNAL_GROUPS: { key: PsxSignalGroup; label: string; icon: React.ElementType }[] = [
  { key: "technical", label: "Market Technicals", icon: BarChart2 },
  { key: "flows", label: "Investor Flows (NCCPL)", icon: Activity },
  { key: "macro", label: "Global Macro", icon: Globe2 },
  { key: "news", label: "News Sentiment", icon: Newspaper },
];

function fmtPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function DirectionIcon({ direction, className }: { direction: string; className?: string }) {
  if (direction === "bullish") return <TrendingUp className={className} />;
  if (direction === "bearish") return <TrendingDown className={className} />;
  return <Minus className={className} />;
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroCard({ data }: { data: PsxPredictionPage }) {
  const p = data.prediction;
  const isBullish = p.direction === "bullish";
  const isBearish = p.direction === "bearish";
  const confColor = {
    high: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    medium: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    low: "text-muted-foreground border-border bg-muted/50",
  }[p.confidence];
  const total = p.positiveCount + p.negativeCount;

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border",
      isBullish ? "border-emerald-500/30" : isBearish ? "border-red-500/30" : "border-border"
    )}>
      <div className={cn(
        "flex flex-col items-center gap-2 px-6 py-8 text-center",
        isBullish ? "bg-emerald-500/8" : isBearish ? "bg-red-500/8" : "bg-muted/20"
      )}>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          PSX — Next Session Outlook · {data.sessionDate}
        </p>
        <p className={cn(
          "text-5xl font-black tracking-tight sm:text-6xl",
          isBullish ? "text-emerald-400" : isBearish ? "text-red-400" : "text-foreground"
        )}>
          {isBullish ? "BULLISH ↑" : isBearish ? "BEARISH ↓" : "NEUTRAL →"}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <span className={cn("text-3xl font-black",
            p.score > 0 ? "text-emerald-400" : p.score < 0 ? "text-red-400" : "text-muted-foreground")}>
            {p.score > 0 ? "+" : ""}{p.score}
            <span className="ml-1 text-base font-normal text-muted-foreground">/ 100</span>
          </span>
          <span className={cn("rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider", confColor)}>
            {p.confidence} confidence
          </span>
          <span className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            {p.generatedBy === "ai" ? "AI Analyst" : "Quant Model"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border border-t border-border sm:grid-cols-4">
        <div className="flex flex-col items-center gap-1 px-4 py-4">
          <TrendingUp className="size-5 text-emerald-400" />
          <span className="text-3xl font-black text-emerald-400">{p.positiveCount}</span>
          <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Positive Signals</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-4 py-4">
          <TrendingDown className="size-5 text-red-400" />
          <span className="text-3xl font-black text-red-400">{p.negativeCount}</span>
          <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Negative Signals</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-4 py-4">
          <Activity className="size-5 text-primary" />
          <span className="text-3xl font-black text-foreground">{p.signals.length}</span>
          <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Signals</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-4 py-4">
          <Newspaper className="size-5 text-sky-400" />
          <span className="text-3xl font-black text-foreground">{data.newsStats.analysed}</span>
          <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">News Analysed</span>
        </div>
      </div>

      {total > 0 && (
        <div className="flex h-1.5 w-full">
          <div className="h-full bg-emerald-500/70" style={{ width: `${Math.round((p.positiveCount / total) * 100)}%` }} />
          <div className="h-full flex-1 bg-red-500/70" />
        </div>
      )}
    </div>
  );
}

// ── Reasoning ─────────────────────────────────────────────────────────────────

function ReasoningCard({ data }: { data: PsxPredictionPage }) {
  const p = data.prediction;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Why this call
      </p>
      <p className="text-base leading-relaxed text-foreground/90">{p.summary}</p>
      {p.keyFactors.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {p.keyFactors.map((f, i) => (
            <div key={i} className={cn("flex items-start gap-3 rounded-xl border p-4",
              f.impact === "positive" ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5")}>
              <div className={cn("mt-0.5 shrink-0", f.impact === "positive" ? "text-emerald-400" : "text-red-400")}>
                {f.impact === "positive" ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-sm font-semibold text-foreground">{f.factor}</span>
                  <span className={cn("rounded px-2 py-0.5 text-xs font-bold",
                    f.impact === "positive" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                    Weight {f.weight}/10
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signal breakdown ──────────────────────────────────────────────────────────

function SignalRow({ s, expanded, onToggle }: { s: PsxSignal; expanded: boolean; onToggle: () => void }) {
  const pos = s.score > 0.5;
  const neg = s.score < -0.5;
  const hasArticles = !!s.articles && s.articles.length > 0;
  return (
    <div>
      <button onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/40">
        <span className="w-44 shrink-0 truncate text-sm font-medium text-foreground sm:w-56">{s.label}</span>
        <span className="hidden shrink-0 text-sm tabular-nums text-muted-foreground sm:inline">{s.value}</span>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="hidden items-center gap-0.5 md:flex">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={cn("h-2.5 w-1.5 rounded-sm",
                i < s.weight ? (pos ? "bg-emerald-500/70" : neg ? "bg-red-500/70" : "bg-primary/40") : "bg-muted"
              )} />
            ))}
          </div>
          <span className={cn(
            "w-14 shrink-0 rounded px-2 py-1 text-center text-xs font-bold tabular-nums",
            pos ? "bg-emerald-500/15 text-emerald-400" : neg ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground"
          )}>
            {s.score > 0 ? "+" : ""}{s.score.toFixed(1)}
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>
      {expanded && (
        <div className="ml-2 mb-2 space-y-2 border-l border-border pl-4 pt-1">
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/80 sm:hidden">{s.value} · </span>
            {s.detail}
          </p>
          {hasArticles && s.articles!.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className={cn("flex items-start gap-2 rounded py-0.5 text-sm leading-snug transition-opacity hover:opacity-80",
                a.sentiment === "positive" ? "text-emerald-400" : "text-red-400")}>
              {a.sentiment === "positive"
                ? <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
                : <TrendingDown className="mt-0.5 size-3.5 shrink-0" />}
              <span className="line-clamp-2">{a.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalBreakdown({ signals }: { signals: PsxSignal[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const grouped = SIGNAL_GROUPS
    .map((g) => ({ ...g, items: signals.filter((s) => s.group === g.key) }))
    .filter((g) => g.items.length > 0);
  if (grouped.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
        Signal Breakdown — tap any signal for the reasoning
      </p>
      <div className="space-y-5">
        {grouped.map((g) => (
          <div key={g.key}>
            <div className="mb-2 flex items-center gap-2">
              <g.icon className="size-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">{g.label}</span>
            </div>
            <div className="space-y-0.5">
              {g.items.map((s) => (
                <SignalRow key={s.id} s={s} expanded={expanded === s.id}
                  onToggle={() => setExpanded(expanded === s.id ? null : s.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Index deep-dive ───────────────────────────────────────────────────────────

function IndexCard({ idx }: { idx: IndexAnalysis }) {
  const isBull = idx.verdict === "bullish";
  const isBear = idx.verdict === "bearish";
  const nearest = idx.dmas.length > 0
    ? idx.dmas.reduce((best, d) =>
        Math.abs(d.value - idx.current) < Math.abs(best.value - idx.current) ? d : best)
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <CandlestickChart className="size-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">{idx.name}</h3>
          </div>
          <p className="mt-1 text-3xl font-black tabular-nums text-foreground">
            {Math.round(idx.current).toLocaleString()}
            <span className={cn("ml-2 text-base font-bold", idx.changePct >= 0 ? "text-emerald-400" : "text-red-400")}>
              {fmtPct(idx.changePct)}
            </span>
          </p>
        </div>
        <span className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider",
          isBull ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : isBear ? "border-red-500/30 bg-red-500/10 text-red-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-400")}>
          <DirectionIcon direction={isBull ? "bullish" : isBear ? "bearish" : "neutral"} className="size-3.5" />
          {idx.verdict}
        </span>
      </div>

      <div className="px-5 py-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
          Moving Averages · {idx.dmaBullCount}/{idx.dmas.length} bullish
          {nearest && <span className="ml-2 normal-case tracking-normal text-primary">— price currently at the {nearest.period} DMA zone</span>}
        </p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-2 py-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Price</p>
            <p className="text-sm font-black tabular-nums text-foreground">{Math.round(idx.current).toLocaleString()}</p>
            <p className="text-sm leading-none">📍</p>
          </div>
          {idx.dmas.map((d) => {
            const isNearest = nearest?.period === d.period;
            return (
              <div key={d.period} className={cn("rounded-lg border px-2 py-2 text-center",
                d.bullish ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5",
                isNearest && "ring-2 ring-primary/70")}>
                <p className={cn("text-[11px] font-bold uppercase tracking-wide",
                  isNearest ? "text-primary" : "text-muted-foreground")}>{d.period} DMA</p>
                <p className="text-sm font-bold tabular-nums text-foreground">{Math.round(d.value).toLocaleString()}</p>
                <p className="text-sm leading-none">{d.bullish ? "🐂" : "🐻"}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Gauge className="size-3.5" />RSI-14
              </span>
              <span className={cn("text-sm font-black tabular-nums",
                idx.rsiState === "overbought" ? "text-red-400" : idx.rsiState === "oversold" ? "text-emerald-400" : "text-foreground")}>
                {idx.rsi14 != null ? idx.rsi14.toFixed(0) : "—"}
                <span className="ml-1.5 text-xs font-semibold uppercase text-muted-foreground">{idx.rsiState}</span>
              </span>
            </div>
            {idx.rsi14 != null && (
              <div className="relative mt-2.5 h-2 w-full rounded-full bg-muted">
                <div className="absolute inset-y-0 left-[30%] w-[40%] rounded-full bg-muted-foreground/15" />
                <div className={cn("absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-background",
                  idx.rsiState === "overbought" ? "bg-red-400" : idx.rsiState === "oversold" ? "bg-emerald-400" : "bg-primary")}
                  style={{ left: `calc(${idx.rsi14}% - 6px)` }} />
              </div>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">52-Week Range</span>
              <span className="text-sm font-black tabular-nums text-foreground">{idx.posIn52w.toFixed(0)}%</span>
            </div>
            <div className="relative mt-2.5 h-2 w-full rounded-full bg-gradient-to-r from-red-500/40 via-muted to-emerald-500/40">
              <div className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-background bg-primary"
                style={{ left: `calc(${idx.posIn52w}% - 6px)` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
              <span>{Math.round(idx.week52Low).toLocaleString()}</span>
              <span>{Math.round(idx.week52High).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {([["1D", idx.returns.d1], ["1W", idx.returns.w1], ["1M", idx.returns.m1], ["3M", idx.returns.m3], ["YTD", idx.returns.ytd]] as const).map(([label, val]) => (
            <span key={label} className={cn("rounded-md px-2.5 py-1 text-xs font-bold tabular-nums",
              val >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
              {label} {fmtPct(val)}
            </span>
          ))}
          {idx.goldenCross != null && (
            <span className={cn("rounded-md px-2.5 py-1 text-xs font-bold",
              idx.goldenCross ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
              {idx.goldenCross ? "Golden Cross ✦" : "Death Cross ✝"}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{idx.verdictDetail}</p>
      </div>
    </div>
  );
}

// ── Sector outlook ────────────────────────────────────────────────────────────

function SectorRow({ s, expanded, onToggle }: { s: SectorOutlook; expanded: boolean; onToggle: () => void }) {
  const isOut = s.outlook === "outperform";
  const isUnder = s.outlook === "underperform";
  return (
    <div className={cn("rounded-xl border transition-colors",
      isOut ? "border-emerald-500/20 bg-emerald-500/[0.03]" : isUnder ? "border-red-500/20 bg-red-500/[0.03]" : "border-border bg-card")}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border",
          isOut ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : isUnder ? "border-red-500/30 bg-red-500/10 text-red-400"
          : "border-border bg-muted/40 text-muted-foreground")}>
          <DirectionIcon direction={isOut ? "bullish" : isUnder ? "bearish" : "neutral"} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{s.sector}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {fmtPct(s.lastSessionPct)} last session · {s.advancers}▲ {s.decliners}▼ of {s.stockCount}
            {s.foreignFlowM != null && Math.abs(s.foreignFlowM) >= 0.1 && (
              <span className={s.foreignFlowM > 0 ? " text-emerald-400" : " text-red-400"}>
                {" "}· FIPI {s.foreignFlowM > 0 ? "+" : ""}${s.foreignFlowM.toFixed(1)}M
              </span>
            )}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider",
          isOut ? "bg-emerald-500/15 text-emerald-400" : isUnder ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground")}>
          {s.outlook}
        </span>
        <span className={cn("w-12 shrink-0 text-right text-sm font-black tabular-nums",
          s.score > 0 ? "text-emerald-400" : s.score < 0 ? "text-red-400" : "text-muted-foreground")}>
          {s.score > 0 ? "+" : ""}{s.score.toFixed(1)}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="border-t border-border/60 px-4 py-3">
          <ul className="space-y-1.5">
            {s.reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/60" />{r}
              </li>
            ))}
          </ul>
          {s.articles.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              {s.articles.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                  className={cn("flex items-start gap-2 text-sm leading-snug transition-opacity hover:opacity-80",
                    a.sentiment === "positive" ? "text-emerald-400" : "text-red-400")}>
                  {a.sentiment === "positive"
                    ? <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
                    : <TrendingDown className="mt-0.5 size-3.5 shrink-0" />}
                  <span className="line-clamp-2">{a.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectorSection({ sectors }: { sectors: SectorOutlook[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  if (sectors.length === 0) return null;
  const outperform = sectors.filter((s) => s.outlook === "outperform").length;
  const underperform = sectors.filter((s) => s.outlook === "underperform").length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers3 className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Sector Outlook — Next Session</h2>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          Scored on technicals + foreign flows + news + global macro · <span className="text-emerald-400">{outperform} outperform</span> · <span className="text-red-400">{underperform} underperform</span>
        </p>
      </div>
      <div className="grid gap-2 xl:grid-cols-2">
        {sectors.map((s) => (
          <SectorRow key={s.sector} s={s} expanded={expanded === s.sector}
            onToggle={() => setExpanded(expanded === s.sector ? null : s.sector)} />
        ))}
      </div>
    </div>
  );
}

// ── Page board ────────────────────────────────────────────────────────────────

export function PredictionBoard({ data }: { data: PsxPredictionPage }) {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Next Day Prediction</h1>
        <p className="text-sm text-muted-foreground">
          Multi-source signal fusion for the next PSX session — refreshed throughout the day as markets and news move.
        </p>
      </div>

      <HeroCard data={data} />
      <ReasoningCard data={data} />
      <SignalBreakdown signals={data.prediction.signals} />

      {data.indices.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <CandlestickChart className="size-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Index Technical Analysis</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {data.indices.map((idx) => <IndexCard key={idx.symbol} idx={idx} />)}
          </div>
        </div>
      )}

      <SectorSection sectors={data.sectors} />

      <p className="pb-4 text-center text-xs italic text-muted-foreground/60">
        {data.prediction.disclaimer}
      </p>
    </div>
  );
}
