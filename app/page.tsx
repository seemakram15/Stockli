import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  LineChart,
  PieChart,
  Bell,
  Star,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { DataDelayBadge } from "@/components/status-badges";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { isDemoMode } from "@/lib/config";
import { APP_NAME } from "@/lib/constants";

const FEATURES = [
  { icon: PieChart, title: "Portfolios & P/L", desc: "Track multiple portfolios with live profit/loss, cost basis and day change." },
  { icon: CalendarRange, title: "Daily P/L calendar", desc: "A month-grid heatmap of each position's gain/loss, day by day." },
  { icon: LineChart, title: "Candlestick charts", desc: "TradingView-grade charts with EOD & intraday series for every listing." },
  { icon: PieChart, title: "Allocation insights", desc: "Sector and holding breakdowns, best/worst performers, diversification." },
  { icon: Star, title: "Watchlists", desc: "Follow tickers you don't own yet and jump straight to their detail page." },
  { icon: Bell, title: "Price alerts", desc: "Above/below thresholds evaluated each refresh — never miss a move." },
];

export default function Home() {
  const primaryHref = isDemoMode ? "/dashboard" : "/signup";
  const primaryLabel = isDemoMode ? "Open the demo" : "Get started — free";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <Logo />
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href={isDemoMode ? "/dashboard" : "/login"}>
              {isDemoMode ? "Demo" : "Sign in"}
            </Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href={primaryHref}>{isDemoMode ? "Launch" : "Sign up"}</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero */}
        <section className="flex flex-col items-center py-16 text-center sm:py-28">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-gain" />
            Built for the Pakistan Stock Exchange
          </div>
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Track your <span className="text-primary">PSX portfolio</span> like a pro
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            {APP_NAME} brings live-ish prices, profit/loss, candlestick charts and a
            daily gain/loss calendar to one clean, fast dashboard. Free, forever.
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col items-stretch gap-3 sm:w-auto sm:max-w-none sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link href={primaryHref}>
                {primaryLabel} <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/market">Browse the market</Link>
            </Button>
            <InstallAppButton size="lg" variant="secondary" />
          </div>
          <div className="mt-6">
            <DataDelayBadge />
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card/60 p-6 backdrop-blur transition-colors hover:border-primary/30"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Trust strip */}
        <section className="mb-20 flex flex-col items-center gap-3 rounded-xl border border-border bg-card/40 px-6 py-8 text-center">
          <ShieldCheck className="size-6 text-primary" />
          <h2 className="text-lg font-semibold">Personal, non-commercial & private</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Your holdings stay yours — protected per-user with row-level security.
            Market data is sourced from the public PSX Data Portal and clearly
            labelled as delayed. No fees, no ads, no resale of data.
          </p>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>For personal use · Data delayed ~15 min · Not investment advice.</p>
        </div>
      </footer>
    </div>
  );
}
