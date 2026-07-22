"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RefreshStatusDialog } from "@/components/refresh/refresh-status-dialog";
import { writePersistentResourceCache } from "@/lib/hooks/use-persistent-resource";
import { invalidateClientPriceCaches } from "@/lib/hooks/use-prices";
import { useRefreshRunner, type RefreshJob } from "@/lib/hooks/use-refresh-runner";
import type { PortfolioCommandPageData } from "@/lib/services/portfolio-command-page";
import type { PortfoliosPageData } from "@/lib/services/portfolios-page";
import { mutate } from "swr";

const MARKET_CACHE_JOBS = [
  { key: "public:psx-market:v3", url: "/api/public/market?fresh=1" },
];

const FUND_CACHE_JOBS = [
  { key: "public:market-strategy", url: "/api/public/market-strategy?fresh=1" },
  { key: "public:market-strategy-holdings", url: "/api/public/market-strategy-holdings?fresh=1" },
  { key: "public:mufap:mutual", url: "/api/public/mufap?kind=mutual&fresh=1" },
  { key: "public:mufap:etfs", url: "/api/public/mufap?kind=etfs&fresh=1" },
  { key: "public:funds-breakdown", url: "/api/public/funds-breakdown?fresh=1" },
];

const GLOBAL_CACHE_JOBS = [
  "us",
  "india",
  "world",
  "commodities",
  "crypto",
  "oil",
].map((market) => ({
  key: `public:global-market:${market}`,
  url: `/api/public/global-market/${market}?fresh=1`,
}));

const OTHER_CACHE_JOBS = [
  { key: "public:youtubers", url: "/api/public/youtubers?fresh=1" },
  { key: "public:mf-top-holdings", url: "/api/public/mf-top-holdings?fresh=1" },
];

export function ManualDataRefreshButton({
  userId,
  onDashboardRefresh,
}: {
  userId: string;
  onDashboardRefresh: () => Promise<PortfolioCommandPageData>;
}) {
  const [open, setOpen] = React.useState(false);

  const jobs = React.useMemo<RefreshJob[]>(
    () => [
      {
        id: "backend",
        label: "Scraping live PSX prices & indexes",
        detail: "Force-clears price/index caches, then pulls the delayed PSX feed",
        critical: true,
        run: async () => {
          const response = await fetch("/api/background/warmup", {
            method: "POST",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify({ mode: "manual", force: true, scope: "backend-only" }),
          });
          if (!response.ok) throw new Error(`Backend refresh failed (${response.status})`);
          const json = (await response.json()) as {
            ok?: boolean;
            skipped?: boolean;
            reason?: string;
            error?: string;
            psxRefreshError?: string;
            refreshedSymbols?: number;
          };
          if (!json.ok) throw new Error(json.error || "Backend refresh failed.");
          if (json.skipped) {
            throw new Error(
              json.reason === "recent-warmup"
                ? "A refresh just ran — wait a moment and try again for a fresh PSX snapshot."
                : "Backend refresh was skipped. Try again in a moment."
            );
          }
          if (json.psxRefreshError) {
            throw new Error(`PSX scrape failed: ${json.psxRefreshError}`);
          }
          invalidateClientPriceCaches();
          await mutate(
            (key) => typeof key === "string" && key.startsWith("/api/prices"),
            undefined,
            { revalidate: true }
          );
          return json.refreshedSymbols
            ? `${json.refreshedSymbols} symbols refreshed`
            : "PSX feed updated";
        },
      },
      {
        id: "dashboard",
        label: "Updating dashboard & portfolios",
        detail: "Recalculating holdings with the latest quotes",
        run: async () => {
          const dashboardData = await onDashboardRefresh();
          await writePersistentResourceCache(`private:portfolios:${userId}`, {
            portfolios: dashboardData.dashboard.portfolios,
            holdings: dashboardData.dashboard.holdings,
            market: dashboardData.market,
            updatedAt: dashboardData.updatedAt,
          } satisfies PortfoliosPageData);

          const portfolioJobs = dashboardData.dashboard.portfolios.map((portfolio) => ({
            key: `private:portfolio:v2:${userId}:${portfolio.id}`,
            url: `/api/private/portfolios/${encodeURIComponent(portfolio.id)}`,
          }));
          const stockJobs = Array.from(
            new Set(dashboardData.dashboard.holdings.map((h) => h.symbol.toUpperCase()))
          ).map((symbol) => ({
            key: `private:stock:${userId}:${symbol}`,
            url: `/api/private/stocks/${encodeURIComponent(symbol)}`,
          }));
          const failures = await refreshCacheJobs([...portfolioJobs, ...stockJobs]);
          if (failures.length) throw new Error(failures[0]);
          return `${dashboardData.dashboard.holdings.length} holdings updated`;
        },
      },
      {
        id: "market",
        label: "Refreshing PSX market board",
        detail: "Indexes, performers, and sector data",
        run: async () => {
          const failures = await refreshCacheJobs(MARKET_CACHE_JOBS);
          if (failures.length) throw new Error(failures[0]);
          return "Market board updated";
        },
      },
      {
        id: "funds",
        label: "Refreshing funds & strategy screens",
        detail: "MUFAP NAVs, holdings strategy, and fund breakdowns",
        run: async () => {
          const failures = await refreshCacheJobs(FUND_CACHE_JOBS);
          if (failures.length) throw new Error(failures.slice(0, 2).join(" · "));
          return "Fund screens updated";
        },
      },
      {
        id: "global",
        label: "Refreshing global markets",
        detail: "US, India, world, commodities, oil, and crypto",
        run: async () => {
          const failures = await refreshCacheJobs(GLOBAL_CACHE_JOBS);
          if (failures.length) throw new Error(failures.slice(0, 2).join(" · "));
          return "Global markets updated";
        },
      },
      {
        id: "finish",
        label: "Saving a fresh copy on this device",
        detail: "Videos, top holdings, and local snapshots",
        run: async () => {
          const failures = await refreshCacheJobs(OTHER_CACHE_JOBS);
          if (failures.length) throw new Error(failures[0]);
          return "All live data is ready";
        },
      },
    ],
    [onDashboardRefresh, userId]
  );

  const runner = useRefreshRunner({ jobs });

  function openAndStart() {
    if (runner.running) return;
    runner.reset();
    setOpen(true);
    window.setTimeout(() => {
      void runner.run();
    }, 40);
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-fuchsia-400 hover:text-white hover:shadow-violet-500/35"
        onClick={openAndStart}
        disabled={runner.running}
      >
        <RotateCw className={runner.running ? "size-4 animate-spin" : "size-4"} />
        Refresh live data
      </Button>

      <RefreshStatusDialog
        open={open}
        onOpenChange={(next) => {
          if (runner.running) return;
          setOpen(next);
          if (!next) runner.reset();
        }}
        title="Refreshing live data"
        description="Force-refreshing PSX prices, indexes, portfolios, and public market screens. Stale caches are cleared so mid-session snapshots cannot stick."
        accent="violet"
        phase={runner.phase}
        headline={runner.headline}
        steps={runner.steps}
        impact={runner.impact}
        errors={runner.errors}
        closeLabel="Close"
        autoCloseMs={2000}
      />
    </>
  );
}

async function refreshCacheJobs(jobs: { key: string; url: string }[]) {
  const results = await Promise.allSettled(jobs.map(refreshCacheJob));
  return results.flatMap((result, index) =>
    result.status === "fulfilled" ? [] : [`${jobs[index].key}: ${String(result.reason)}`]
  );
}

async function refreshCacheJob(job: { key: string; url: string }) {
  const response = await fetch(job.url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  const json = (await response.json()) as { data?: unknown };
  if (!("data" in json)) throw new Error("Response did not include data");
  await writePersistentResourceCache(job.key, json.data);
}
