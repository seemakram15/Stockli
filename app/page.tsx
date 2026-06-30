import { Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { BarChart3, Bell, Globe2, Search, Sparkles, Target, Wallet, Zap } from "lucide-react";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { UrlAuthDialog } from "@/components/auth/url-auth-dialog";
import { LandingHero } from "@/components/landing/landing-hero";
import {
  FeatureCarousel,
  Reveal,
  ServiceMarquee,
  Stagger,
  StaggerItem,
} from "@/components/landing/landing-motion";
import { SiteFooter } from "@/components/landing/site-footer";
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

      <LandingHero demo={isDemoMode} />

      <main>
        <section className="border-y border-border bg-card/70 py-4">
          <ServiceMarquee className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" />
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
          <Reveal className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              <Zap className="size-3.5 text-primary" />
              All services, one command center
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Built for portfolios today, shaped for every market you add next.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {APP_NAME} keeps market data, portfolio math, fundamentals and account
              security in separate clean layers, so the experience stays fast as the
              product grows.
            </p>
          </Reveal>

          <Stagger className="grid gap-3 sm:grid-cols-2">
            {SERVICE_GROUPS.map((group) => (
              <StaggerItem
                key={group.title}
                className="group h-full rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
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
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className="bg-card/45">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <Reveal className="mb-8 max-w-2xl">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="size-4" />
                Portfolio operating system
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Every screen moves the investor forward.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Swipe through the workspace — markets, portfolios, funds, analysis and
                alerts each keep the next action close: refresh, trade, watch, compare.
              </p>
            </Reveal>

            <Reveal delay={0.05}>
              <FeatureCarousel />
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <Reveal className="mb-8 max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Three moves, every trading day.
            </h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              From the first dashboard glance to a fundamentals comparison, the flow stays
              the same: discover, compare, act.
            </p>
          </Reveal>
          <Stagger className="grid gap-4 md:grid-cols-3">
            {WORKFLOW.map((step, index) => (
              <StaggerItem
                key={step.title}
                className="h-full rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.desc}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
          <Reveal>
            <div className="relative grid gap-6 overflow-hidden rounded-3xl border border-white/10 bg-[#07130f] p-6 text-white shadow-xl sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/20 blur-3xl" />
              <div className="relative">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-emerald-300 text-[#07130f]">
                  <Zap className="size-5" />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Ready before the market opens.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                  Start with the portfolios and markets you already follow. Keep the same
                  workspace as {APP_NAME} expands into a broader market command center.
                </p>
              </div>
              <div className="relative grid grid-cols-2 gap-2 sm:flex sm:flex-row lg:flex-col">
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
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
