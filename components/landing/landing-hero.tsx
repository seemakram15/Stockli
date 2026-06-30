"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, LockKeyhole, ShieldCheck, TrendingUp } from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import {
  AuroraField,
  CountUp,
  FloatingBadge,
  LandingCommandPanel,
} from "@/components/landing/landing-motion";
import { Logo } from "@/components/logo";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DataDelayBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

const HERO_STATS: Array<{ to: number; suffix?: string; prefix?: string; label: string; note: string }> = [
  { to: 9, suffix: "+", label: "Markets & assets", note: "PSX, US, India, funds, crypto" },
  { to: 30, suffix: "s", label: "Live refresh", note: "Server-cached price polling" },
  { to: 100, suffix: "%", label: "Free to use", note: "Runs on free tiers, no card" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.1 + i * 0.09, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function LandingHero({ demo }: { demo: boolean }) {
  const reduce = useReducedMotion();
  const primaryLabel = demo ? "Open demo" : "Start tracking free";

  const animateProps = (i: number) =>
    reduce
      ? {}
      : { custom: i, variants: fadeUp, initial: "hidden" as const, animate: "show" as const };

  return (
    <section className="relative overflow-hidden bg-[#04100d] text-white">
      {/* Layered background: photo wash + aurora + grid */}
      <Image
        src="/landing/market-command-center.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[58%_center] opacity-40"
      />
      <div className="absolute inset-0 bg-[linear-gradient(95deg,rgba(3,11,9,0.97)_0%,rgba(3,11,9,0.9)_44%,rgba(3,11,9,0.55)_100%)]" />
      <AuroraField className="opacity-80" />
      <div className="absolute inset-0 bg-grid-faint opacity-[0.5] [mask-image:radial-gradient(80%_80%_at_50%_0%,black,transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/70 to-transparent" />

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link href="/" aria-label={`${APP_NAME} home`}>
          <Logo className="text-white" />
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          {demo ? (
            <Button asChild variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
              <Link href="/dashboard">Demo</Link>
            </Button>
          ) : (
            <AuthDialog initialMode="login" demo={demo}>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
                Sign in
              </Button>
            </AuthDialog>
          )}
          {demo ? (
            <Button asChild size="sm" className="hidden bg-white text-[#07130f] hover:bg-white/90 sm:inline-flex">
              <Link href="/dashboard">Launch</Link>
            </Button>
          ) : (
            <AuthDialog initialMode="signup" demo={demo}>
              <Button size="sm" className="hidden bg-white text-[#07130f] hover:bg-white/90 sm:inline-flex">
                Sign up
              </Button>
            </AuthDialog>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(94svh-4.5rem)] max-w-7xl items-center gap-10 px-4 pb-14 pt-6 sm:min-h-[calc(94svh-5rem)] sm:px-6 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,0.78fr)] lg:px-8">
        <div className="min-w-0">
          <motion.div
            className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 backdrop-blur-md"
            {...animateProps(0)}
          >
            <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
            <span className="truncate">One workspace for markets, funds, portfolios & alerts</span>
          </motion.div>

          <motion.h1
            className="text-balance text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.5rem]"
            {...animateProps(1)}
          >
            Your entire market,
            <br className="hidden sm:block" /> on{" "}
            <span className="text-gradient-brand">{APP_NAME}</span>.
          </motion.h1>

          <motion.p
            className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/80 sm:text-lg"
            {...animateProps(2)}
          >
            Track every market move, every holding, every daily return and every alert
            from one fast, installable portfolio command center — PSX, US, India,
            funds, crypto and more.
          </motion.p>

          <motion.div className="mt-7 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3" {...animateProps(3)}>
            <div className="min-w-0">
              {demo ? (
                <Button
                  asChild
                  size="lg"
                  className="group h-11 w-full min-w-0 gap-1 bg-emerald-400 px-2 text-xs font-semibold text-[#07130f] shadow-[0_8px_30px_rgba(16,185,129,0.35)] hover:bg-emerald-300 sm:w-auto sm:px-5 sm:text-sm"
                >
                  <Link href="/dashboard">
                    <span className="sm:hidden">Start</span>
                    <span className="hidden sm:inline">{primaryLabel}</span>
                    <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              ) : (
                <AuthDialog initialMode="signup" demo={demo}>
                  <Button
                    size="lg"
                    className="group h-11 w-full min-w-0 gap-1 bg-emerald-400 px-2 text-xs font-semibold text-[#07130f] shadow-[0_8px_30px_rgba(16,185,129,0.35)] hover:bg-emerald-300 sm:w-auto sm:px-5 sm:text-sm"
                  >
                    <span className="sm:hidden">Start</span>
                    <span className="hidden sm:inline">{primaryLabel}</span>
                    <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </AuthDialog>
              )}
            </div>
            <div className="min-w-0">
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 w-full min-w-0 gap-1 border-white/20 bg-white/10 px-2 text-xs font-semibold text-white hover:bg-white/15 hover:text-white sm:w-auto sm:px-5 sm:text-sm"
              >
                <Link href="/market">
                  <span className="sm:hidden">Market</span>
                  <span className="hidden sm:inline">Browse market</span>
                  <ArrowUpRight className="size-4 shrink-0" />
                </Link>
              </Button>
            </div>
            <div className="min-w-0">
              <InstallAppButton
                label="Install"
                size="lg"
                variant="secondary"
                className="h-11 w-full min-w-0 justify-center bg-white/10 px-2 text-xs font-semibold text-white hover:bg-white/20 sm:w-auto sm:px-5 sm:text-sm"
              />
            </div>
          </motion.div>

          <motion.div className="mt-5 flex max-w-full flex-wrap items-center gap-2 sm:gap-3" {...animateProps(4)}>
            <DataDelayBadge className="border-white/15 bg-white/10 text-white/70" />
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-white/65 sm:text-xs">
              <LockKeyhole className="size-3.5 shrink-0" />
              <span className="truncate">Secure accounts with per-user portfolio access</span>
            </span>
          </motion.div>

          <motion.div className="mt-7 grid grid-cols-3 gap-2 sm:mt-9 sm:gap-3" {...animateProps(5)}>
            {HERO_STATS.map((stat) => (
              <div
                key={stat.label}
                className="min-w-0 rounded-xl border border-white/15 bg-white/[0.07] p-3 backdrop-blur-md transition-colors hover:border-emerald-300/40 sm:p-4"
              >
                <p className="mt-0.5 truncate text-xl font-semibold text-white sm:text-3xl">
                  <CountUp to={stat.to} prefix={stat.prefix} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-wide text-emerald-100/70 sm:text-xs">
                  {stat.label}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/55 sm:text-xs sm:leading-5">
                  {stat.note}
                </p>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="relative min-w-0">
          <div className="pointer-events-none absolute -left-4 -top-2 z-20 hidden lg:block">
            <FloatingBadge icon={TrendingUp} delay={0.4}>
              KSE100 +1.06%
            </FloatingBadge>
          </div>
          <div className="pointer-events-none absolute -bottom-3 -right-2 z-20 hidden lg:block">
            <FloatingBadge icon={ShieldCheck} delay={1.1}>
              RLS secured
            </FloatingBadge>
          </div>
          <LandingCommandPanel />
        </div>
      </div>
    </section>
  );
}
