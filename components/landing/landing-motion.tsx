"use client";

import * as React from "react";
import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowRight,
  Bell,
  Bitcoin,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Coins,
  Droplets,
  Globe2,
  LineChart,
  PieChart,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { LiveAreaChart, LiveTickerValue } from "@/components/landing/landing-live";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

/** Fade + rise into view once. Respects prefers-reduced-motion. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

const STAGGER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/** Container that staggers its <StaggerItem> children into view. */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={STAGGER}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={STAGGER_ITEM}>
      {children}
    </motion.div>
  );
}

/** Drifting aurora blobs for dark surfaces. Pure decoration. */
export function AuroraField({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const blob = "absolute rounded-full blur-3xl mix-blend-screen";
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      <motion.div
        className={cn(blob, "left-[-10%] top-[-20%] size-[42rem] bg-emerald-500/25")}
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={cn(blob, "right-[-12%] top-[6%] size-[36rem] bg-sky-500/20")}
        animate={reduce ? undefined : { x: [0, -50, 0], y: [0, 60, 0], scale: [1.1, 1, 1.1] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className={cn(blob, "bottom-[-25%] left-[30%] size-[40rem] bg-amber-400/15")}
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Count-up metric                                                    */
/* ------------------------------------------------------------------ */

export function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 1.6,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce || !inView) {
      node.textContent = `${prefix}${to}${suffix}`;
      return;
    }
    const controls = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(value) {
        node.textContent = `${prefix}${Math.round(value)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, prefix, suffix, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Marquee (seamless horizontal auto-scroll)                          */
/* ------------------------------------------------------------------ */

function Marquee({
  children,
  duration = 26,
  reverse = false,
  className,
}: {
  children: React.ReactNode;
  duration?: number;
  reverse?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const track = (
    <div className="flex shrink-0 items-center gap-3 pr-3">{children}</div>
  );
  return (
    <div className={cn("group/marquee flex overflow-hidden", className)} aria-hidden>
      <motion.div
        className="flex"
        animate={reduce ? undefined : { x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
      >
        {track}
        {track}
      </motion.div>
    </div>
  );
}

const SERVICES: Array<{ label: string; icon: LucideIcon; tone: "gain" | "info" | "gold" }> = [
  { label: "PSX portfolios", icon: Wallet, tone: "gain" },
  { label: "Daily P/L calendars", icon: CalendarRange, tone: "info" },
  { label: "Mutual funds", icon: Coins, tone: "gold" },
  { label: "ETF tracking", icon: PieChart, tone: "gain" },
  { label: "US S&P 500", icon: LineChart, tone: "info" },
  { label: "India market", icon: Globe2, tone: "gain" },
  { label: "Crypto market", icon: Bitcoin, tone: "gold" },
  { label: "Oil & commodities", icon: Droplets, tone: "info" },
  { label: "Price alerts", icon: Bell, tone: "gain" },
  { label: "Installable app", icon: Smartphone, tone: "info" },
  { label: "Secure accounts", icon: ShieldCheck, tone: "gold" },
];

export function ServiceMarquee({ className }: { className?: string }) {
  return (
    <Marquee duration={32} className={className}>
      {SERVICES.map((service, index) => {
        const Icon = service.icon;
        return (
          <span
            key={`${service.label}-${index}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-semibold shadow-sm",
              service.tone === "gain" && "border-primary/25 text-primary",
              service.tone === "info" && "border-chart-2/30 text-chart-2",
              service.tone === "gold" && "border-chart-3/35 text-chart-3"
            )}
          >
            <Icon className="size-4" />
            {service.label}
            <ArrowRight className="size-3.5 opacity-50" />
          </span>
        );
      })}
    </Marquee>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero command panel (animated live flow)                            */
/* ------------------------------------------------------------------ */

const TICKS = [
  ["FFC", "+1.42%", "gain"],
  ["MEBL", "+0.74%", "gain"],
  ["PPL", "-0.21%", "loss"],
  ["Gold", "+0.33%", "gain"],
  ["BTC", "+1.18%", "gain"],
  ["WTI", "-0.46%", "loss"],
] as const;

export function LandingCommandPanel() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="relative min-w-0"
      initial={reduce ? false : { opacity: 0, y: 36, rotateX: 8 }}
      animate={reduce ? undefined : { opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1200 }}
    >
      <motion.div
        className="absolute -inset-6 rounded-[2rem] bg-emerald-400/10 blur-2xl"
        animate={reduce ? undefined : { opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="relative min-w-0 overflow-hidden rounded-2xl border border-white/15 bg-[#081714]/80 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-5"
        animate={reduce ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
              Live command flow
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">One screen, every market move</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100">
            <span className="live-dot size-1.5 rounded-full bg-emerald-300 text-emerald-300" />
            Live
          </span>
        </div>

        {/* Live index chart */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/25 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                KSE-100 index
              </p>
              <p className="mt-0.5 text-2xl font-semibold text-white">
                <LiveTickerValue base={118432.51} spread={120} seed="kse100" />
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-400/15 px-2 py-1 text-sm font-semibold text-emerald-300">
              <TrendingUp className="size-3.5" />
              <LiveTickerValue base={1.06} spread={0.08} prefix="+" suffix="%" seed="kse100pct" />
            </span>
          </div>
          <LiveAreaChart className="mt-2" />
        </div>

        {/* Live portfolio stats */}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Day P/L</p>
            <p className="mt-1 text-base font-semibold text-emerald-300">
              <LiveTickerValue base={8906} spread={260} decimals={0} prefix="+Rs " seed="daypl" />
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Total value</p>
            <p className="mt-1 text-base font-semibold text-white">
              <LiveTickerValue base={1107249} spread={900} decimals={0} prefix="Rs " seed="total" />
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <Marquee duration={18} className="px-2 py-2">
            {[...TICKS].map(([symbol, change, tone], index) => (
              <span
                key={`${symbol}-${index}`}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg border bg-white/[0.08] px-3 py-2 text-xs font-semibold",
                  tone === "gain" ? "border-emerald-300/20 text-emerald-100" : "border-red-300/20 text-red-100"
                )}
              >
                {symbol}
                <span className="tabular-nums">{change}</span>
              </span>
            ))}
          </Marquee>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature carousel (auto-advancing horizontal slides)                */
/* ------------------------------------------------------------------ */

type Slide = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  desc: string;
  chips: string[];
  metric: { value: string; label: string };
};

const SLIDES: Slide[] = [
  {
    icon: Globe2,
    eyebrow: "Coverage",
    title: "Every market in one workspace",
    desc: "Pakistan Stock Exchange, US S&P 500, a global world view, oil, commodities and crypto — tracked side by side without switching apps.",
    chips: ["PSX", "US S&P 500", "World", "Oil", "Crypto"],
    metric: { value: "9+", label: "market surfaces" },
  },
  {
    icon: Wallet,
    eyebrow: "Portfolios",
    title: "Live P/L with persistent calendars",
    desc: "Weighted-average cost, day and total P/L, realized vs unrealized returns, and a month-grid gain/loss calendar that keeps your history intact.",
    chips: ["Holdings", "Transactions", "Day P/L", "Calendars", "Allocation"],
    metric: { value: "Rs", label: "real-time P/L" },
  },
  {
    icon: PieChart,
    eyebrow: "Funds",
    title: "Mutual funds, ETFs & daily returns",
    desc: "MUFAP mutual funds, AMC filters, exchange-traded funds and a daily funds-returns report — the whole funds universe in one flow.",
    chips: ["Mutual funds", "ETFs", "AMC filters", "Daily returns", "Fund profiles"],
    metric: { value: "MUFAP", label: "fund data" },
  },
  {
    icon: LineChart,
    eyebrow: "Analysis",
    title: "Fundamentals & AI stock analyzer",
    desc: "Financial statements, ratios and peer comparison, plus an AI analyzer and pivot points to turn raw numbers into a decision faster.",
    chips: ["Fundamentals", "Ratios", "Peer compare", "AI analyzer", "Pivot points"],
    metric: { value: "AI", label: "powered insights" },
  },
  {
    icon: Bell,
    eyebrow: "Stay ready",
    title: "Watchlists, alerts & explore",
    desc: "Follow symbols, set above/below price alerts evaluated on every refresh, and explore board meetings, book closures, dividends and market videos.",
    chips: ["Watchlists", "Price alerts", "Board meetings", "Dividends", "Videos"],
    metric: { value: "24/7", label: "alerting" },
  },
  {
    icon: Smartphone,
    eyebrow: "Anywhere",
    title: "Installable, fast & secure",
    desc: "Install it like a native app on iPhone, Android and desktop. Per-user access and row-level security keep every portfolio private.",
    chips: ["PWA install", "iOS & Android", "Dark mode", "RLS security", "⌘K search"],
    metric: { value: "PWA", label: "app-like" },
  },
];

export function FeatureCarousel() {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const reduce = useReducedMotion();
  const count = SLIDES.length;

  const go = React.useCallback(
    (dir: number) => setIndex((i) => (i + dir + count) % count),
    [count]
  );
  const set = React.useCallback((i: number) => setIndex(i), []);

  React.useEffect(() => {
    if (paused || reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), 4500);
    return () => window.clearInterval(id);
  }, [paused, reduce, count]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xl">
        {/* gradient wash + grid */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent_60%)]" />

        <div className="relative">
          <div>
            <motion.div
              key={index}
              initial={reduce ? false : { opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              drag={reduce ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) go(1);
                else if (info.offset.x > 80) go(-1);
              }}
              className="grid min-h-[26rem] cursor-grab gap-6 p-6 active:cursor-grabbing sm:min-h-[22rem] sm:p-9 lg:grid-cols-[1.15fr_0.85fr] lg:items-center"
            >
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Icon className="size-3.5" />
                  {slide.eyebrow}
                </span>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {slide.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  {slide.desc}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {slide.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative">
                <motion.div
                  className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#06120f] to-[#0f2a23] p-6 text-white shadow-lg"
                  animate={reduce ? undefined : { y: [0, -8, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute right-3 top-3 text-emerald-300/70">
                    <Icon className="size-7" />
                  </div>
                  <p className="text-5xl font-semibold tracking-tight text-gradient-brand sm:text-6xl">
                    {slide.metric.value}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/70">{slide.metric.label}</p>
                  <div className="mt-5 grid gap-1.5">
                    {[68, 84, 52].map((w, i) => (
                      <motion.span
                        key={i}
                        className="block h-2 rounded-full bg-white/10"
                        initial={reduce ? false : { width: 0 }}
                        animate={{ width: `${w}%` }}
                        transition={{ duration: 0.8, delay: 0.2 + i * 0.12 }}
                      >
                        <span className="block h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" />
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* controls */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Show ${s.title}`}
              aria-current={i === index}
              onClick={() => set(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-7 bg-primary" : "w-2.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small decorative bits                                              */
/* ------------------------------------------------------------------ */

export function FloatingBadge({
  icon: Icon,
  children,
  className,
  delay = 0,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md",
        className
      )}
      animate={reduce ? undefined : { y: [0, -6, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay }}
    >
      <Icon className="size-3.5 text-emerald-300" />
      {children}
    </motion.span>
  );
}
