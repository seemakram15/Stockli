import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarRange,
  Globe2,
  LineChart,
  LockKeyhole,
  PieChart,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DataDelayBadge } from "@/components/status-badges";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { UrlAuthDialog } from "@/components/auth/url-auth-dialog";
import { isDemoMode } from "@/lib/config";
import { APP_NAME } from "@/lib/constants";

const MARKET_SIGNALS = [
  { label: "Market coverage", value: "PSX now", note: "More exchanges next" },
  { label: "Portfolio pulse", value: "Live P/L", note: "Positions, sectors, calendars" },
  { label: "Installable", value: "iOS + Android", note: "Works like an app" },
];

const FEATURES = [
  {
    icon: Wallet,
    title: "Multi-portfolio tracking",
    desc: "Track cost basis, day P/L, unrealized P/L and realized returns across every portfolio.",
  },
  {
    icon: CalendarRange,
    title: "Daily P/L calendars",
    desc: "See each day in PKR value, with live session prices keeping the current day precise.",
  },
  {
    icon: LineChart,
    title: "Market-grade charts",
    desc: "Move from portfolio view to stock detail with clean candlesticks, performers and sector context.",
  },
  {
    icon: PieChart,
    title: "Allocation intelligence",
    desc: "Understand holdings by sector, portfolio and symbol with clear visuals built for quick decisions.",
  },
  {
    icon: Star,
    title: "Watchlists and alerts",
    desc: "Follow symbols before you buy and keep price thresholds visible without cluttering your portfolio.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    desc: "Per-user access controls and row-level security keep holdings separated at the database layer.",
  },
];

const WORKFLOW = [
  { icon: Search, title: "Discover", desc: "Search listings, sectors and performers without leaving the app shell." },
  { icon: BarChart3, title: "Understand", desc: "Compare exposure, day movement and position quality at a glance." },
  { icon: Bell, title: "Act", desc: "Use alerts, transactions and calendars to stay ahead of market days." },
];

const MARKET_RAILS = [
  "PSX",
  "Stocks",
  "Sectors",
  "Watchlists",
  "Alerts",
  "Portfolios",
  "P/L calendars",
  "More markets soon",
];

export default function Home() {
  const primaryLabel = isDemoMode ? "Open the demo" : "Start tracking free";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        <UrlAuthDialog demo={isDemoMode} />
      </Suspense>
      <section className="relative min-h-[92svh] overflow-hidden bg-[#06120f] text-white">
        <Image
          src="/landing/market-command-center.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-90"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_28%,rgba(14,165,132,0.28),transparent_28%),linear-gradient(90deg,rgba(3,9,8,0.96)_0%,rgba(3,9,8,0.82)_43%,rgba(3,9,8,0.38)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/70 to-transparent" />

        <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
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

        <div className="relative z-10 mx-auto flex min-h-[calc(92svh-5rem)] max-w-7xl flex-col justify-center px-4 pb-12 pt-8 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-50 backdrop-blur-md">
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.9)]" />
              PSX-ready today. Built for every market you will add next.
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[0.94] tracking-normal sm:text-7xl lg:text-8xl">
              {APP_NAME}
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/80 sm:text-lg">
              An all-in-one portfolio command center for investors who want holdings,
              live P/L, calendars, alerts, sectors and market movement in one fast
              installable web app.
            </p>
            <div className="mt-8 flex w-full max-w-sm flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row">
              {isDemoMode ? (
                <Button asChild size="lg" className="h-11 gap-2 bg-emerald-400 text-[#07130f] hover:bg-emerald-300">
                  <Link href="/dashboard">
                    {primaryLabel} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <AuthDialog initialMode="signup" demo={isDemoMode}>
                  <Button size="lg" className="h-11 gap-2 bg-emerald-400 text-[#07130f] hover:bg-emerald-300">
                    {primaryLabel} <ArrowRight className="size-4" />
                  </Button>
                </AuthDialog>
              )}
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              >
                <Link href="/market">
                  Browse market <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <InstallAppButton
                size="lg"
                variant="secondary"
                className="h-11 bg-white/10 text-white hover:bg-white/20"
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <DataDelayBadge className="border-white/15 bg-white/10 text-white/70" />
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/60">
                <LockKeyhole className="size-3.5" />
                Secure accounts with per-user portfolio access
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {MARKET_SIGNALS.map((signal) => (
              <div
                key={signal.label}
                className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
              >
                <p className="text-xs font-medium uppercase text-white/50">{signal.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-normal text-white">{signal.value}</p>
                <p className="mt-1 text-sm text-white/60">{signal.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main>
        <section className="border-y border-border bg-card/55">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2 px-4 py-4 sm:px-6 lg:px-8">
            {MARKET_RAILS.map((item) => (
              <span
                key={item}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Globe2 className="size-3.5 text-primary" />
              One workspace, many markets
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              Built for PSX portfolios now, structured for global expansion.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Stockli keeps market data, portfolio math and security concerns separated
              so the app can grow from PSX into additional exchanges without changing
              the way investors use it day to day.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <Activity className="size-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">Fast market context</p>
                <p className="mt-1 text-sm text-muted-foreground">Performers, sectors and stock pages stay one click away.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <Smartphone className="size-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">Phone-first install</p>
                <p className="mt-1 text-sm text-muted-foreground">Launch from iPhone, Android or desktop like a native app.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/35"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card/45">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Investor workflow</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
                  Move from market noise to a clear next action.
                </h2>
              </div>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/market">
                  View market <TrendingUp className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {WORKFLOW.map((step, index) => (
                <div key={step.title} className="rounded-xl border border-border bg-background p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <step.icon className="size-5" />
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-6 rounded-2xl border border-border bg-[#07130f] p-6 text-white shadow-sm sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-emerald-300 text-[#07130f]">
                <Zap className="size-5" />
              </div>
              <h2 className="text-3xl font-semibold tracking-normal">Ready when the market opens.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Start with your PSX holdings today. Keep the same dashboard as Stockli
                grows into a broader, all-market portfolio tracker.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
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
                  <Link href="/dashboard">Open dashboard</Link>
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
