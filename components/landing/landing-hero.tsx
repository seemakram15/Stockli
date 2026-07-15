"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, Globe2, LockKeyhole, RefreshCw, Sparkles } from "lucide-react";
import { AuroraField, CountUp } from "@/components/landing/landing-motion";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { DataDelayBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

/* ── Stat strip (rendered below hero) ─────────────────────────────── */

const STATS = [
  {
    icon: Globe2,
    value: 9,
    suffix: "+",
    label: "Markets & assets",
    note: "PSX, US, funds, crypto",
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: RefreshCw,
    value: 30,
    suffix: "s",
    label: "Live refresh",
    note: "Server-cached price polling",
    color: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: Sparkles,
    value: 100,
    suffix: "%",
    label: "Free to use",
    note: "Runs on free tiers, no card",
    color: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
] as const;

export function HeroStatStrip() {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-4 px-6 py-7 sm:px-8">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                  <Icon className={`size-5 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-2xl font-bold tabular-nums ${s.color}`}>
                    <CountUp to={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-sm font-semibold text-foreground">{s.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: 0.55 + i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function LandingHero({ demo }: { demo: boolean }) {
  const reduce = useReducedMotion();
  const primaryLabel = demo ? "Open demo" : "Start tracking free";
  const primaryHref = demo ? "/portfolios" : "/signup";

  const ap = (i: number) =>
    reduce ? {} : { custom: i, variants: fadeUp, initial: "hidden" as const, animate: "show" as const };

  return (
    <section className="relative overflow-hidden bg-[#04100d] text-white">
      {/* Background SVG — right side vivid */}
      <Image
        src="/landing/hero-dashboard.svg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[62%_center] opacity-60"
      />

      {/* Gradient: opaque left → transparent right */}
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(4,16,13,0.98)_0%,rgba(4,16,13,0.97)_28%,rgba(4,16,13,0.72)_52%,rgba(4,16,13,0.12)_100%)]" />

      <AuroraField className="opacity-50" />
      <div className="absolute inset-0 bg-grid-faint opacity-[0.3] [mask-image:radial-gradient(60%_80%_at_20%_0%,black,transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/60 to-transparent" />

      {/* Content: flush left within page margins */}
      <div className="relative z-10 min-h-[88svh] px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="flex min-h-[88svh] flex-col justify-center py-24 sm:py-32 lg:max-w-[52%] xl:max-w-[48%]">

          <h1 className="text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-[5rem] xl:text-[5.5rem]">
            <span className="block">Your entire market,</span>
            <span className="block text-gradient-brand">on {APP_NAME}.</span>
          </h1>

          {/* Subtitle */}
          <motion.p
            className="mt-6 max-w-[440px] text-pretty text-base leading-relaxed text-white/70 sm:text-lg sm:leading-8"
            {...ap(0)}
          >
            One command center for every market you care about. Track PSX stocks,
            US indices, mutual funds, crypto and commodities — with live P&L,
            alerts and instant portfolio insight.
          </motion.p>

          {/* CTAs */}
          <motion.div className="mt-8 flex flex-wrap gap-3" {...ap(1)}>
            <Button
              asChild
              size="lg"
              className="group btn-shine btn-shine-auto btn-glow-emerald gap-2 bg-emerald-400 px-6 font-semibold text-[#07130f] hover:bg-emerald-300"
            >
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="btn-shine gap-2 border-white/20 bg-white/10 font-semibold text-white hover:bg-white/15 hover:text-white"
            >
              <Link href="/market">
                Browse market
                <ArrowUpRight className="size-4 shrink-0" />
              </Link>
            </Button>
            <InstallAppButton
              label="Install"
              size="lg"
              variant="secondary"
              className="gap-2 bg-white/10 font-semibold text-white hover:bg-white/20"
            />
          </motion.div>

          {/* Trust badges */}
          <motion.div className="mt-5 flex flex-wrap items-center gap-3" {...ap(2)}>
            <DataDelayBadge className="border-white/15 bg-white/10 text-white/65" />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/50">
              <LockKeyhole className="size-3.5 shrink-0" />
              Secure accounts with per-user portfolio access
            </span>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
