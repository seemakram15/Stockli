import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import Script from "next/script";
import type { Metadata } from "next";
import { BarChart3, Bell, Globe2, Search, Target, Wallet, Zap } from "lucide-react";
import { LandingHeader } from "@/components/landing/landing-header";
import { HeroStatStrip, LandingHero } from "@/components/landing/landing-hero";
import { Reveal, ServiceMarquee, Stagger, StaggerItem } from "@/components/landing/landing-motion";
import {
  FundamentalsShowcase,
  type LeaderRow,
  MarketLeaderboard,
  MobileSection,
  ScreenshotShowcase,
  Testimonials,
} from "@/components/landing/landing-sections";
import { SiteFooter } from "@/components/landing/site-footer";
import { LOGO_SYMBOLS } from "@/components/landing/stock-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionContext } from "@/lib/auth/roles";
import { config, isDemoMode } from "@/lib/config";
import { APP_NAME } from "@/lib/constants";
import { getMarketRows } from "@/lib/services/prices";
import { getAppSettings } from "@/lib/services/app-settings";
import { PAGE_REGISTRY } from "@/lib/access/page-registry";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function getTopMovers(): Promise<{ gainers?: LeaderRow[]; losers?: LeaderRow[]; live: boolean }> {
  try {
    // Never let the public landing page hang on a cold cache / slow scrape.
    const rows = await withTimeout(getMarketRows(), 2500);
    // Curate to major, liquid PSX names we have real logos for — every row gets a
    // proper logo, with real prices and up/down from the live feed.
    const liquid = rows.filter(
      (r) => r.current > 0 && Number.isFinite(r.changePct) && LOGO_SYMBOLS.has(r.symbol.toUpperCase())
    );
    const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const toRow = (r: (typeof liquid)[number]): LeaderRow => ({
      symbol: r.symbol.toUpperCase(),
      name: r.sector ?? "PSX equity",
      price: fmt(r.current),
      change: r.changePct,
    });
    const up = liquid.filter((r) => r.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5);
    const down = liquid.filter((r) => r.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5);
    if (up.length >= 3 && down.length >= 3) {
      return { gainers: up.map(toRow), losers: down.map(toRow), live: true };
    }
  } catch {
    /* fall through to sample data in the component */
  }
  return { live: false };
}

/* Streams in after first paint so a cold market cache never blocks the page. */
async function LeaderboardStream({ authed }: { authed: boolean }) {
  const movers = await getTopMovers();
  return <MarketLeaderboard authed={authed} gainers={movers.gainers} losers={movers.losers} live={movers.live} />;
}

function LeaderboardFallback() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-20 w-full max-w-lg" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="border-b border-border p-4">
            <Skeleton className="h-9 w-56" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export const metadata: Metadata = {
  title: `${APP_NAME} — All-market portfolio workspace`,
  description:
    "Track PSX, US, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
  alternates: { canonical: "/" },
  openGraph: {
    title: `${APP_NAME} — All-market portfolio workspace`,
    description:
      "Track PSX, US, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
    url: "/",
  },
  twitter: {
    title: `${APP_NAME} — All-market portfolio workspace`,
    description:
      "Track PSX, US, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
  },
};

const SERVICE_GROUPS = [
  {
    icon: Globe2,
    title: "Markets",
    desc: "Pakistan Stock Exchange, US indices, India indices, world view, oil, commodities and crypto.",
    items: ["PSX stocks", "KSE indexes", "US S&P 500", "India market", "World view"],
    iconCls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    border: "hover:border-emerald-500/45",
  },
  {
    icon: Target,
    title: "Funds",
    desc: "MUFAP mutual funds, ETFs, AMC filters and daily funds return reporting in one flow.",
    items: ["Mutual funds", "ETFs", "AMC filters", "Funds daily returns", "Fund profiles"],
    iconCls: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    border: "hover:border-sky-500/45",
  },
  {
    icon: Wallet,
    title: "Portfolios",
    desc: "Holdings, transactions, average cost, day P/L, total P/L, allocation and persistent calendars.",
    items: ["Holdings", "Transactions", "Allocation", "P/L history", "Watchlists"],
    iconCls: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    border: "hover:border-violet-500/45",
  },
  {
    icon: BarChart3,
    title: "Analysis",
    desc: "Stock fundamentals, financial statements, ratios, peer comparison and market videos.",
    items: ["Fundamentals", "Peer comparison", "Youtubers", "Alerts", "Admin tools"],
    iconCls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    border: "hover:border-amber-500/45",
  },
];

const WORKFLOW = [
  {
    icon: Search,
    title: "Discover",
    desc: "Search stocks, funds, sectors, commodities and pages from one global search surface.",
    cls: "bg-sky-500 text-white",
  },
  {
    icon: BarChart3,
    title: "Compare",
    desc: "Review KSE-100 returns against portfolios, peer fundamentals and sector exposure.",
    cls: "bg-violet-500 text-white",
  },
  {
    icon: Bell,
    title: "Act",
    desc: "Use alerts, trades, calendars and refresh controls to stay ready for each market day.",
    cls: "bg-emerald-500 text-white",
  },
];

export default async function Home() {
  const { user } = await getSessionContext();
  const authed = Boolean(user);

  // A real signed-in visitor landing on the marketing page (e.g. following an
  // old bookmark, or the canonical redirect from the site root) should go
  // straight to their portfolio — demo mode keeps its own "Open demo" flow.
  if (authed && !isDemoMode) {
    redirect("/portfolios");
  }

  // The landing page ("/") isn't itself a registered nav page, so it can't
  // rely on getSessionContext()'s per-page guest synthesis. Read the global
  // settings directly instead, purely to render accurate links/lock icons —
  // real enforcement still happens when a link is actually followed.
  const appSettings = isDemoMode ? null : await getAppSettings();
  const isGuest = !authed && (isDemoMode || Boolean(appSettings?.guestBrowsingEnabled));
  const guestPageAccess = isGuest
    ? Object.fromEntries(
        PAGE_REGISTRY.map((entry) => [entry.key, appSettings ? appSettings.isPageEnabled(entry.key) : true])
      )
    : null;
  const primaryHref = isDemoMode ? "/portfolios" : "/signup";
  const primaryLabel = isDemoMode ? "Open demo" : "Start tracking free";

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: APP_NAME,
        url: config.siteUrl,
        description:
          "Track PSX, US, mutual funds, ETFs, crypto, commodities and live portfolio P/L in one installable market workspace.",
      },
      {
        "@type": "SoftwareApplication",
        name: APP_NAME,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, iOS, Android, Desktop",
        url: config.siteUrl,
        description:
          "Installable multi-market portfolio and analysis workspace for PSX, US, funds, commodities, oil and crypto.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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

      <LandingHeader
        authed={authed}
        displayName={user?.displayName}
        isGuest={isGuest}
        guestPageAccess={guestPageAccess}
      />

      <LandingHero demo={isDemoMode} />

      <main>
        <HeroStatStrip />

        <section className="border-b border-border bg-card/70 py-4">
          <ServiceMarquee className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" />
        </section>

        {/* Reference flow: market leaderboard (streamed) */}
        <Suspense fallback={<LeaderboardFallback />}>
          <LeaderboardStream authed={authed} />
        </Suspense>

        {/* Fundamentals & AI analyzer */}
        <FundamentalsShowcase authed={authed} />

        {/* Every tool you need */}
        <section className="bg-card/45">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-20">
            <Reveal className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                <Zap className="size-3.5" />
                Every tool a Pakistani investor needs
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
                  className={`group h-full rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg ${group.border}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${group.iconCls}`}>
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
          </div>
        </section>

        {/* Screenshot showcase — real app screens */}
        <ScreenshotShowcase />

        {/* Reviews */}
        <Testimonials />

        {/* Three moves */}
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
                  <span className={`flex size-10 items-center justify-center rounded-xl ${step.cls}`}>
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

        {/* Mobile / PWA */}
        <MobileSection />

        {/* Final CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
          <Reveal>
            <div className="relative grid gap-6 overflow-hidden rounded-3xl border border-white/10 bg-[#07130f] p-6 text-white shadow-xl sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-emerald-500/25 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-10 size-56 rounded-full bg-sky-500/20 blur-3xl" />
              <div className="relative">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-teal-300 text-[#07130f]">
                  <Zap className="size-5" />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  The smartest way to track markets in Pakistan.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                  Start with the portfolios and markets you already follow. Keep the same
                  workspace as {APP_NAME} expands into a broader market command center.
                </p>
              </div>
              <div className="relative grid grid-cols-2 gap-2 sm:flex sm:flex-row lg:flex-col">
                <Button asChild size="lg" className="btn-shine btn-glow-emerald bg-gradient-to-r from-emerald-400 to-teal-300 text-[#07130f] hover:from-emerald-300 hover:to-teal-200">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                >
                  <Link href={isDemoMode ? "/portfolios" : authed ? "/portfolios" : "/login"}>
                    {authed || isDemoMode ? "Open portfolio" : "Sign in"}
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
