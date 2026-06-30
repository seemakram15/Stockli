"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  BadgePercent,
  Bell,
  Bitcoin,
  CandlestickChart,
  ChevronDown,
  Droplets,
  FileText,
  Globe2,
  Layers3,
  LayoutDashboard,
  LineChart,
  Lock,
  Menu,
  Star,
  Target,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Leaf = { label: string; href: string; icon: LucideIcon; tint: string };
type Item = { label: string; href?: string; icon?: LucideIcon; children?: Leaf[] };

const NAV: Item[] = [
  {
    label: "Markets",
    children: [
      { label: "PSX stock market", href: "/market", icon: TrendingUp, tint: "text-emerald-500" },
      { label: "Sector performance", href: "/market/sectors", icon: LineChart, tint: "text-sky-500" },
      { label: "US S&P 500", href: "/market/us", icon: LineChart, tint: "text-violet-500" },
      { label: "India market", href: "/market/india", icon: CandlestickChart, tint: "text-amber-500" },
      { label: "World view", href: "/market/world", icon: Globe2, tint: "text-cyan-500" },
      { label: "Crypto", href: "/market/crypto", icon: Bitcoin, tint: "text-orange-500" },
      { label: "Oil & commodities", href: "/market/oil", icon: Droplets, tint: "text-rose-500" },
    ],
  },
  {
    label: "Funds",
    children: [
      { label: "Mutual funds", href: "/market/mutual-funds", icon: BadgePercent, tint: "text-emerald-500" },
      { label: "Exchange traded funds", href: "/market/etfs", icon: Layers3, tint: "text-sky-500" },
      { label: "Funds daily returns", href: "/market/strategy", icon: Target, tint: "text-violet-500" },
    ],
  },
  {
    label: "Tools",
    children: [
      { label: "Stock analyzer", href: "/analysis/stock-analyzer", icon: LineChart, tint: "text-emerald-500" },
      { label: "Fundamentals", href: "/analysis/fundamentals", icon: FileText, tint: "text-sky-500" },
      { label: "Pivot points", href: "/analysis/pivot-points", icon: Target, tint: "text-amber-500" },
    ],
  },
  { label: "Portfolio", href: "/portfolios", icon: Wallet },
  { label: "Watchlist", href: "/watchlist", icon: Star },
  { label: "Alerts", href: "/alerts", icon: Bell },
];

export function LandingHeader({ authed, displayName }: { authed: boolean; displayName?: string | null }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // gate any app route behind sign-in
  const gate = React.useCallback(
    (href: string) => (authed ? href : `/login?redirectTo=${encodeURIComponent(href)}`),
    [authed]
  );

  const initials = (displayName || "You")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const onLight = scrolled; // solid header → use theme foreground; transparent → white over hero
  const linkColor = onLight ? "text-foreground/75 hover:text-foreground" : "text-white/80 hover:text-white";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[120] transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={`${APP_NAME} home`} className="shrink-0">
          <Logo className={onLight ? "" : "text-white"} />
        </Link>

        {/* Desktop nav */}
        <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) =>
            item.children ? (
              <div key={item.label} className="group relative">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    linkColor
                  )}
                >
                  {item.label}
                  {!authed && <Lock className="size-3 opacity-60" />}
                  <ChevronDown className="size-3.5 opacity-70 transition-transform group-hover:rotate-180" />
                </button>
                {/* dropdown */}
                <div className="invisible absolute left-0 top-full pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <div className="w-72 overflow-hidden rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-xl shadow-black/10">
                    {item.children.map((leaf) => (
                      <Link
                        key={leaf.href}
                        href={gate(leaf.href)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
                      >
                        <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                          <leaf.icon className={cn("size-4", leaf.tint)} />
                        </span>
                        <span className="text-sm font-medium">{leaf.label}</span>
                      </Link>
                    ))}
                    {!authed && (
                      <Link
                        href="/login"
                        className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Lock className="size-3.5" /> Sign in to unlock
                        </span>
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={item.label}
                href={gate(item.href!)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  linkColor
                )}
              >
                {item.label}
                {!authed && <Lock className="size-3 opacity-60" />}
              </Link>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <span className={onLight ? "" : "[&_button]:text-white [&_button]:hover:bg-white/10"}>
            <ThemeToggle />
          </span>

          {authed ? (
            <>
              <Button asChild size="sm" className="hidden gap-1.5 bg-emerald-500 text-white hover:bg-emerald-400 sm:inline-flex">
                <Link href="/dashboard">
                  <LayoutDashboard className="size-4" /> Dashboard
                </Link>
              </Button>
              <Link
                href="/dashboard"
                aria-label="Open dashboard"
                className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-500 text-xs font-semibold text-white shadow-sm"
              >
                {initials}
              </Link>
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={cn("hidden sm:inline-flex", onLight ? "" : "text-white hover:bg-white/10 hover:text-white")}
              >
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/25 hover:from-emerald-500 hover:to-emerald-300">
                <Link href="/signup">
                  Get started <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}

          {/* mobile toggle */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg lg:hidden",
              onLight ? "text-foreground hover:bg-muted" : "text-white hover:bg-white/10"
            )}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden"
          >
            <div className="mx-3 mb-3 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl">
              {!authed && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-300">
                  <Lock className="size-4" /> Sign in to unlock every menu
                </div>
              )}
              {NAV.flatMap((item) => (item.children ? item.children : [{ label: item.label, href: item.href!, icon: item.icon ?? Wallet, tint: "text-emerald-500" }])).map(
                (leaf) => (
                  <Link
                    key={leaf.href + leaf.label}
                    href={gate(leaf.href)}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
                  >
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <leaf.icon className={cn("size-4", leaf.tint)} />
                    </span>
                    <span className="text-sm font-medium">{leaf.label}</span>
                    {!authed && <Lock className="ml-auto size-3.5 text-muted-foreground" />}
                  </Link>
                )
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {authed ? (
                  <Button asChild className="col-span-2 bg-emerald-500 text-white hover:bg-emerald-400">
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)}>Open dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link href="/login" onClick={() => setMobileOpen(false)}>Sign in</Link>
                    </Button>
                    <Button asChild className="bg-gradient-to-r from-emerald-500 to-teal-400 text-white">
                      <Link href="/signup" onClick={() => setMobileOpen(false)}>Get started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
