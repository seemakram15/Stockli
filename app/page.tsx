import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Globe2,
  LockKeyhole,
  Search,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { UrlAuthDialog } from "@/components/auth/url-auth-dialog";
import {
  LandingCommandPanel,
  LandingFeatureShowcase,
  ServiceMarquee,
} from "@/components/landing/landing-motion";
import { Logo } from "@/components/logo";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DataDelayBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { config, isDemoMode } from "@/lib/config";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} — All-market portfolio workspace`,
  description:
    "Track PSX, US, India, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${APP_NAME} — All-market portfolio workspace`,
    description:
      "Track PSX, US, India, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
    url: "/",
  },
  twitter: {
    title: `${APP_NAME} — All-market portfolio workspace`,
    description:
      "Track PSX, US, India, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
  },
};

const HERO_STATS = [
  { label: "Coverage", value: "All markets", note: "PSX, US, India, funds, crypto" },
  { label: "Portfolio pulse", value: "Live P/L", note: "Day, total and calendar returns" },
  { label: "Installable", value: "App-like", note: "Built for iOS, Android and desktop" },
];

const SERVICE_GROUPS = [
  {
    icon: Globe2,
    title: "Markets",
    desc: "Pakistan Stock Exchange, US indices, India indices, world view, oil, commodities and crypto.",
    items: ["PSX stocks", "KSE indexes", "US S&P 500", "India market", "World view"],
  },
  {
    icon: Target,
    title: "Funds",
    desc: "MUFAP mutual funds, ETFs, AMC filters and daily funds return reporting in one flow.",
    items: ["Mutual funds", "ETFs", "AMC filters", "Funds daily returns", "Fund profiles"],
  },
  {
    icon: Wallet,
    title: "Portfolios",
    desc: "Holdings, transactions, average cost, day P/L, total P/L, allocation and persistent calendars.",
    items: ["Holdings", "Transactions", "Allocation", "P/L history", "Watchlists"],
  },
  {
    icon: BarChart3,
    title: "Analysis",
    desc: "Stock fundamentals, financial statements, ratios, peer comparison and market videos.",
    items: ["Fundamentals", "Peer comparison", "Youtubers", "Alerts", "Admin tools"],
  },
];

const WORKFLOW = [
  {
    icon: Search,
    title: "Discover",
    desc: "Search stocks, funds, sectors, commodities and pages from one global search surface.",
  },
  {
    icon: BarChart3,
    title: "Compare",
    desc: "Review KSE-100 returns against portfolios, peer fundamentals and sector exposure.",
  },
  {
    icon: Bell,
    title: "Act",
    desc: "Use alerts, trades, calendars and refresh controls to stay ready for each market day.",
  },
];

export default function Home() {
  const primaryLabel = isDemoMode ? "Open demo" : "Start tracking free";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: APP_NAME,
        url: config.siteUrl,
        description:
          "Track PSX, US, India, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
      },
      {
        "@type": "SoftwareApplication",
        name: APP_NAME,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, iOS, Android, Desktop",
        url: config.siteUrl,
        description:
          "Installable multi-market portfolio and analysis workspace for PSX, US, India, funds, commodities, oil and crypto.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Script
        id="stockli-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <Suspense fallback={null}>
        <UrlAuthDialog demo={isDemoMode} />
      </Suspense>

      <section className="relative overflow-hidden bg-[#06120f] text-white">
        <Image
          src="/landing/market-command-center.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[58%_center] opacity-95"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,9,8,0.97)_0%,rgba(3,9,8,0.86)_42%,rgba(3,9,8,0.48)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/75 to-transparent" />

        <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <Link href="/" aria-label={`${APP_NAME} home`}>
            <Logo className="text-white" />
          </Link>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {isDemoMode ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/dashboard">Demo</Link>
              </Button>
            ) : (
              <AuthDialog initialMode="login" demo={isDemoMode}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 hover:text-white"
                >
                  Sign in
                </Button>
              </AuthDialog>
            )}
            {isDemoMode ? (
              <Button asChild size="sm" className="hidden bg-white text-[#07130f] hover:bg-white/90 sm:inline-flex">
                <Link href="/dashboard">Launch</Link>
              </Button>
            ) : (
              <AuthDialog initialMode="signup" demo={isDemoMode}>
                <Button size="sm" className="hidden bg-white text-[#07130f] hover:bg-white/90 sm:inline-flex">
                  Sign up
                </Button>
              </AuthDialog>
            )}
          </div>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(94svh-4.5rem)] max-w-7xl items-center gap-8 px-4 pb-12 pt-6 sm:min-h-[calc(96svh-5rem)] sm:px-6 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,0.75fr)] lg:px-8">
          <div className="min-w-0">
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 backdrop-blur-md">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
              <span className="truncate">One workspace for markets, funds, portfolios and alerts</span>
            </div>

            <h1 className="text-balance text-5xl font-semibold leading-[0.94] tracking-normal sm:text-7xl lg:text-8xl">
              {APP_NAME}
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/80 sm:text-lg">
              Track every market move, every holding, every daily return and every
              alert from one fast installable portfolio command center.
            </p>

            <div className="mt-7 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <div className="min-w-0">
                {isDemoMode ? (
                  <Button
                    asChild
                    size="lg"
                    className="h-11 w-full min-w-0 gap-1 bg-emerald-400 px-2 text-xs font-semibold text-[#07130f] hover:bg-emerald-300 sm:w-auto sm:px-5 sm:text-sm"
                  >
                    <Link href="/dashboard">
                      <span className="sm:hidden">Start</span>
                      <span className="hidden sm:inline">{primaryLabel}</span>
                      <ArrowRight className="size-4 shrink-0" />
                    </Link>
                  </Button>
                ) : (
                  <AuthDialog initialMode="signup" demo={isDemoMode}>
                    <Button
                      size="lg"
                      className="h-11 w-full min-w-0 gap-1 bg-emerald-400 px-2 text-xs font-semibold text-[#07130f] hover:bg-emerald-300 sm:w-auto sm:px-5 sm:text-sm"
                    >
                      <span className="sm:hidden">Start</span>
                      <span className="hidden sm:inline">{primaryLabel}</span>
                      <ArrowRight className="size-4 shrink-0" />
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
            </div>

            <div className="mt-5 flex max-w-full flex-wrap items-center gap-2 sm:gap-3">
              <DataDelayBadge className="border-white/15 bg-white/10 text-white/70" />
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-white/65 sm:text-xs">
                <LockKeyhole className="size-3.5 shrink-0" />
                <span className="truncate">Secure accounts with per-user portfolio access</span>
              </span>
            </div>

            <div className="mt-7 grid grid-cols-3 gap-2 sm:mt-9 sm:gap-3">
              {HERO_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="min-w-0 rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-md sm:p-4"
                >
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/50 sm:text-xs">
                    {stat.label}
                  </p>
                  <p className="mt-1 truncate text-base font-semibold text-white sm:mt-2 sm:text-2xl">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/60 sm:mt-1 sm:text-sm sm:leading-5">
                    {stat.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <LandingCommandPanel />
        </div>
      </section>

      <main>
        <section className="border-y border-border bg-card/70 py-4">
          <ServiceMarquee className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" />
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Zap className="size-3.5 text-primary" />
              All services, one command center
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              Built for portfolios today, shaped for every market you add next.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Stockli keeps market data, portfolio math, fundamentals and account
              security in separate clean layers, so the experience stays fast as the
              product grows.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {SERVICE_GROUPS.map((group) => (
              <div
                key={group.title}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/35"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <group.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{group.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{group.desc}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card/45">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.15fr] lg:px-8 lg:py-20">
            <div>
              <p className="text-sm font-semibold text-primary">Portfolio operating system</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
                Every screen moves the investor forward.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                From the first dashboard glance to a stock fundamentals comparison,
                the app keeps the next action close: refresh, trade, watch, alert or compare.
              </p>
              <Button asChild variant="outline" className="mt-6 w-full sm:w-auto">
                <Link href="/market">
                  Explore markets <TrendingUp className="size-4" />
                </Link>
              </Button>
            </div>

            <LandingFeatureShowcase />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-4 md:grid-cols-3">
            {WORKFLOW.map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
          <div className="grid gap-6 rounded-2xl border border-border bg-[#07130f] p-6 text-white shadow-sm sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-emerald-300 text-[#07130f]">
                <Zap className="size-5" />
              </div>
              <h2 className="text-3xl font-semibold tracking-normal">Ready before the market opens.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Start with the portfolios and markets you already follow. Keep the same
                workspace as Stockli expands into a broader market command center.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row lg:flex-col">
              {isDemoMode ? (
                <Button asChild size="lg" className="bg-emerald-400 text-[#07130f] hover:bg-emerald-300">
                  <Link href="/dashboard">{primaryLabel}</Link>
                </Button>
              ) : (
                <AuthDialog initialMode="signup" demo={isDemoMode}>
                  <Button size="lg" className="bg-emerald-400 text-[#07130f] hover:bg-emerald-300">
                    {primaryLabel}
                  </Button>
                </AuthDialog>
              )}
              {isDemoMode ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <AuthDialog initialMode="login" demo={isDemoMode}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  >
                    Sign in
                  </Button>
                </AuthDialog>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <Logo />
          <p>For personal use. Market data may be delayed. Not investment advice.</p>
        </div>
      </footer>
    </div>
  );
}
