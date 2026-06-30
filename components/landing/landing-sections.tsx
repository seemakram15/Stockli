"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Brain,
  FileText,
  Gauge,
  Layers,
  Lock,
  Quote,
  Radio,
  Smartphone,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { Reveal } from "@/components/landing/landing-motion";
import { StockLogo } from "@/components/landing/stock-logo";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/* ---------------- Markets leaderboard ---------------- */

export type LeaderRow = { symbol: string; name: string; price: string; change: number };

const SAMPLE_GAINERS: LeaderRow[] = [
  { symbol: "MEBL", name: "Commercial Banks", price: "318.40", change: 4.82 },
  { symbol: "FFC", name: "Fertilizer", price: "452.10", change: 3.41 },
  { symbol: "LUCK", name: "Cement", price: "1,284.00", change: 2.95 },
  { symbol: "OGDC", name: "Oil & Gas Exploration", price: "246.77", change: 1.88 },
  { symbol: "ENGRO", name: "Fertilizer", price: "402.55", change: 1.12 },
];
const SAMPLE_LOSERS: LeaderRow[] = [
  { symbol: "PPL", name: "Oil & Gas Exploration", price: "198.20", change: -2.31 },
  { symbol: "HUBC", name: "Power Generation", price: "142.90", change: -1.74 },
  { symbol: "PSO", name: "Oil & Gas Marketing", price: "388.05", change: -1.20 },
  { symbol: "DGKC", name: "Cement", price: "112.40", change: -0.96 },
  { symbol: "TRG", name: "Technology", price: "64.18", change: -0.55 },
];

export function MarketLeaderboard({
  authed,
  gainers,
  losers,
  live = false,
}: {
  authed: boolean;
  gainers?: LeaderRow[];
  losers?: LeaderRow[];
  live?: boolean;
}) {
  const [tab, setTab] = React.useState<"gainers" | "losers">("gainers");
  const gain = gainers && gainers.length ? gainers : SAMPLE_GAINERS;
  const lose = losers && losers.length ? losers : SAMPLE_LOSERS;
  const isLive = live && Boolean(gainers?.length);
  const rows = tab === "gainers" ? gain : lose;
  const ctaHref = authed ? "/market" : "/login?redirectTo=%2Fmarket";

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600 dark:text-sky-300">
            <Sparkles className="size-3.5" />
            Live-ish market pulse
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Spot the movers{" "}
            <span className="text-gradient-brand">before your neighbour</span> does.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Top gainers and losers across the Pakistan Stock Exchange, refreshed through
            {" "}{APP_NAME}&apos;s cached market feed. Sign in to open the full market with
            sectors, indices, funds and global markets.
          </p>
          <Button
            asChild
            className="mt-6 gap-2 bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-300"
          >
            <Link href={ctaHref}>
              {authed ? "Open live market" : "Sign in to open market"}
              {authed ? <ArrowRight className="size-4" /> : <Lock className="size-4" />}
            </Link>
          </Button>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div className="inline-flex rounded-lg bg-muted p-1">
                <button
                  type="button"
                  onClick={() => setTab("gainers")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                    tab === "gainers" ? "bg-emerald-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TrendingUp className="size-4" /> Gainers
                </button>
                <button
                  type="button"
                  onClick={() => setTab("losers")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                    tab === "losers" ? "bg-rose-500 text-white shadow" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <TrendingDown className="size-4" /> Losers
                </button>
              </div>
              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex",
                  isLive
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                    : "border-border text-muted-foreground"
                )}
              >
                {isLive ? (
                  <>
                    <Radio className="size-3.5 animate-pulse" /> Live · PKR
                  </>
                ) : (
                  "PKR · delayed ~15 min"
                )}
              </span>
            </div>

            <div className="divide-y divide-border">
              {rows.map((row, i) => {
                const up = row.change >= 0;
                return (
                  <motion.div
                    key={row.symbol}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <StockLogo symbol={row.symbol} up={up} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{row.symbol}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.name}</p>
                    </div>
                    <p className="hidden text-sm font-medium tabular-nums text-muted-foreground sm:block">
                      Rs {row.price}
                    </p>
                    <span
                      className={cn(
                        "inline-flex w-20 shrink-0 items-center justify-end gap-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums",
                        up ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" : "bg-rose-500/12 text-rose-600 dark:text-rose-300"
                      )}
                    >
                      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                      {up ? "+" : ""}
                      {row.change.toFixed(2)}%
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

type Review = { name: string; role: string; initials: string; tint: string; quote: string };

const REVIEWS: Review[] = [
  {
    name: "Hamza R.",
    role: "Long-term investor",
    initials: "HR",
    tint: "from-emerald-500 to-teal-400",
    quote: "The daily P/L calendar is a game changer. I finally see exactly how my PSX positions move each session — and the alerts keep me ready before the open.",
  },
  {
    name: "Sana K.",
    role: "Mutual funds saver",
    initials: "SK",
    tint: "from-sky-500 to-indigo-400",
    quote: "Funds, ETFs and stocks in one place. The daily funds-returns report alone replaced three spreadsheets I used to maintain by hand.",
  },
  {
    name: "Bilal A.",
    role: "Active trader",
    initials: "BA",
    tint: "from-violet-500 to-fuchsia-400",
    quote: "Fundamentals, peer comparison and the AI analyzer help me make a call fast. It feels like a proper terminal, but free and installable on my phone.",
  },
];

export function Testimonials() {
  return (
    <section className="bg-card/45">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-300">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            Loved by investors
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for how Pakistanis actually invest.
          </h2>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            From long-term savers to active traders — one colourful workspace for every market move.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {REVIEWS.map((review, i) => (
            <Reveal key={review.name} delay={i * 0.08}>
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                <Quote className="size-7 text-primary/30" />
                <blockquote className="mt-3 flex-1 text-sm leading-6 text-foreground/90">
                  {review.quote}
                </blockquote>
                <div className="mt-4 flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-4 fill-amber-400" />
                  ))}
                </div>
                <figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  <span className={cn("flex size-10 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white", review.tint)}>
                    {review.initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{review.name}</p>
                    <p className="text-xs text-muted-foreground">{review.role}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Mobile / PWA ---------------- */

export function MobileSection() {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
            <Smartphone className="size-3.5" />
            Installable PWA
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Works beautifully on your phone.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
            Install {APP_NAME} like a native app on iPhone, Android and desktop — home-screen
            icon, full-screen, fast. Your portfolios, calendars and alerts travel with you.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <InstallAppButton
              label="Install app"
              size="lg"
              className="gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-400"
            />
            <Button asChild size="lg" variant="outline">
              <Link href="/signup">Create free account</Link>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.05} className="flex justify-center">
          <motion.div
            className="relative w-[15rem] rounded-[2.2rem] border-4 border-foreground/10 bg-[#04100d] p-3 shadow-2xl"
            animate={reduce ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-white/15" />
            <div className="space-y-2 rounded-2xl bg-black/30 p-3 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gradient-brand">{APP_NAME}</span>
                <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Live</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-wide text-white/45">Total value</p>
                <p className="text-lg font-semibold">Rs 1,107,249</p>
                <p className="text-xs font-semibold text-emerald-300">+Rs 7,585 today</p>
              </div>
              {[
                ["KSE100", "+1.06%", true],
                ["MEBL", "+4.82%", true],
                ["PPL", "-2.31%", false],
              ].map(([s, c, up]) => (
                <div key={s as string} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
                  <span className="font-medium">{s}</span>
                  <span className={cn("font-semibold", up ? "text-emerald-300" : "text-rose-300")}>{c}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Fundamentals & AI analyzer ---------------- */

const FUNDAMENTALS = [
  { label: "Market cap", value: "Rs 452B", tint: "text-foreground" },
  { label: "P/E ratio", value: "6.8x", tint: "text-sky-600 dark:text-sky-300" },
  { label: "EPS (TTM)", value: "Rs 38.4", tint: "text-foreground" },
  { label: "ROE", value: "24.6%", tint: "text-emerald-600 dark:text-emerald-300" },
  { label: "Dividend yield", value: "9.2%", tint: "text-amber-600 dark:text-amber-300" },
  { label: "Debt / Equity", value: "0.41", tint: "text-violet-600 dark:text-violet-300" },
];

const PEERS = [
  { name: "FFC", roe: 82, tint: "from-emerald-500 to-teal-400" },
  { name: "EFERT", roe: 64, tint: "from-sky-500 to-indigo-400" },
  { name: "FATIMA", roe: 47, tint: "from-violet-500 to-fuchsia-400" },
];

const SIGNALS = [
  { label: "Valuation", verdict: "Attractive", tint: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
  { label: "Momentum", verdict: "Strong", tint: "bg-sky-500/12 text-sky-600 dark:text-sky-300" },
  { label: "Profitability", verdict: "High", tint: "bg-violet-500/12 text-violet-600 dark:text-violet-300" },
  { label: "Risk", verdict: "Moderate", tint: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
];

export function FundamentalsShowcase({ authed }: { authed: boolean }) {
  const toolsHref = authed ? "/analysis/fundamentals" : "/login?redirectTo=%2Fanalysis%2Ffundamentals";
  const score = 72;

  return (
    <section className="bg-card/45">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mb-8 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-600 dark:text-violet-300">
            <Brain className="size-3.5" />
            Fundamentals & AI analyzer
          </span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Turn raw numbers into a decision, faster.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Overview, statements, cash flows and ratios with peer comparison — then let the
            AI analyzer weigh valuation, momentum, profitability and risk into one clear read.
          </p>
        </Reveal>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Fundamentals card */}
          <Reveal>
            <div className="h-full overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-border p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <FileText className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Fundamentals & comparison</p>
                    <p className="text-xs text-muted-foreground">FFC · Fertilizer</p>
                  </div>
                </div>
                <div className="hidden gap-1 rounded-lg bg-muted p-1 text-xs font-semibold sm:flex">
                  {["Overview", "Statements", "Ratios", "Peers"].map((t, i) => (
                    <span
                      key={t}
                      className={cn(
                        "rounded-md px-2 py-1",
                        i === 0 ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                      )}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                {FUNDAMENTALS.map((m) => (
                  <div key={m.label} className="bg-card p-4">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className={cn("mt-1 text-lg font-semibold tabular-nums", m.tint)}>{m.value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Layers className="size-3.5" /> Peer comparison · ROE
                </div>
                <div className="space-y-2.5">
                  {PEERS.map((p) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-sm font-medium">{p.name}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <motion.span
                          className={cn("block h-full rounded-full bg-gradient-to-r", p.tint)}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${p.roe}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8 }}
                        />
                      </span>
                      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{p.roe}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* AI analyzer card */}
          <Reveal delay={0.05}>
            <div className="relative h-full overflow-hidden rounded-2xl border border-violet-500/25 bg-card shadow-xl">
              <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-violet-500/15 blur-3xl" />
              <div className="relative flex items-center gap-3 border-b border-border p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Brain className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">AI stock analyzer</p>
                  <p className="text-xs text-muted-foreground">Synthesised from the latest fundamentals</p>
                </div>
              </div>

              <div className="relative p-5">
                <div className="flex items-center gap-5">
                  <div className="relative flex size-24 shrink-0 items-center justify-center">
                    <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="9" className="text-muted" />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="url(#aiscore)"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 42}
                        initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                        whileInView={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - score / 100) }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                      />
                      <defs>
                        <linearGradient id="aiscore" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#34d399" />
                          <stop offset="1" stopColor="#22d3ee" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold tabular-nums">{score}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">/ 100</span>
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                      <Gauge className="size-4" /> Bullish bias
                    </span>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Attractive valuation and a strong dividend, with healthy profitability —
                      momentum confirms the trend; keep an eye on commodity-cycle risk.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  {SIGNALS.map((s) => (
                    <div key={s.label} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.tint)}>{s.verdict}</span>
                    </div>
                  ))}
                </div>

                <Button
                  asChild
                  className="mt-5 w-full gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-fuchsia-400"
                >
                  <Link href={toolsHref}>
                    {authed ? "Open fundamentals & analyzer" : "Sign in to open tools"}
                    {authed ? <ArrowRight className="size-4" /> : <Lock className="size-4" />}
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
