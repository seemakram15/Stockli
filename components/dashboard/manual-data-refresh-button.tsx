"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw, RotateCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { writePersistentResourceCache } from "@/lib/hooks/use-persistent-resource";
import type { PortfolioCommandPageData } from "@/lib/services/portfolio-command-page";
import type { PortfoliosPageData } from "@/lib/services/portfolios-page";

type StepState = "pending" | "active" | "done" | "error";

interface RefreshStep {
  id: string;
  label: string;
  state: StepState;
}

const INITIAL_STEPS: RefreshStep[] = [
  { id: "backend", label: "Getting the latest PSX prices", state: "pending" },
  { id: "dashboard", label: "Refreshing your dashboard and portfolios", state: "pending" },
  { id: "market", label: "Refreshing market pages", state: "pending" },
  { id: "funds", label: "Refreshing funds and return screens", state: "pending" },
  { id: "global", label: "Refreshing global markets and commodities", state: "pending" },
  { id: "finish", label: "Saving the latest data on this device", state: "pending" },
];

const MARKET_CACHE_JOBS = [
  { key: "public:psx-market", url: "/api/public/market" },
];

const FUND_CACHE_JOBS = [
  { key: "public:market-strategy", url: "/api/public/market-strategy" },
  { key: "public:mufap:mutual", url: "/api/public/mufap?kind=mutual" },
  { key: "public:mufap:etfs", url: "/api/public/mufap?kind=etfs" },
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
  url: `/api/public/global-market/${market}`,
}));

const OTHER_CACHE_JOBS = [
  { key: "public:youtubers", url: "/api/public/youtubers" },
];

export function ManualDataRefreshButton({
  userId,
  onDashboardRefresh,
  cachedAt,
}: {
  userId: string;
  onDashboardRefresh: () => Promise<PortfolioCommandPageData>;
  cachedAt: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [steps, setSteps] = React.useState<RefreshStep[]>(INITIAL_STEPS);
  const [message, setMessage] = React.useState("Ready to load the latest market data.");
  const [errors, setErrors] = React.useState<string[]>([]);

  const reset = React.useCallback(() => {
    setSteps(INITIAL_STEPS);
    setMessage("Ready to load the latest market data.");
    setErrors([]);
  }, []);

  async function runRefresh() {
    setOpen(true);
    setRunning(true);
    setErrors([]);
    setMessage("Connecting to the latest market feeds...");
    setSteps(INITIAL_STEPS);

    const failures: string[] = [];

    try {
      await runStep("backend", "Bringing in the latest PSX prices", async () => {
        const response = await fetch("/api/background/warmup", {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ mode: "manual", force: true, scope: "backend-only" }),
        });
        if (!response.ok) {
          throw new Error(`Backend refresh failed (${response.status})`);
        }
        const json = (await response.json()) as { ok?: boolean; error?: string };
        if (!json.ok) {
          throw new Error(json.error || "Backend refresh failed.");
        }
      });

      await runStep("dashboard", "Refreshing your dashboard, portfolios, and stock pages", async () => {
        const dashboardData = await onDashboardRefresh();
        await writePersistentResourceCache(`private:portfolios:${userId}`, {
          portfolios: dashboardData.dashboard.portfolios,
          holdings: dashboardData.dashboard.holdings,
          market: dashboardData.market,
          updatedAt: dashboardData.updatedAt,
        } satisfies PortfoliosPageData);

        const portfolioJobs = dashboardData.dashboard.portfolios.map((portfolio) => ({
          key: `private:portfolio:${userId}:${portfolio.id}`,
          url: `/api/private/portfolios/${encodeURIComponent(portfolio.id)}`,
        }));
        const stockJobs = Array.from(
          new Set(dashboardData.dashboard.holdings.map((holding) => holding.symbol.toUpperCase()))
        ).map((symbol) => ({
          key: `private:stock:${userId}:${symbol}`,
          url: `/api/private/stocks/${encodeURIComponent(symbol)}`,
        }));
        failures.push(...(await refreshCacheJobs([...portfolioJobs, ...stockJobs])));
      });

      await runStep("market", "Refreshing PSX market pages", async () => {
        failures.push(...(await refreshCacheJobs(MARKET_CACHE_JOBS)));
      });

      await runStep("funds", "Refreshing funds, strategy, and return data", async () => {
        failures.push(...(await refreshCacheJobs(FUND_CACHE_JOBS)));
      });

      await runStep("global", "Refreshing global markets, commodities, oil, and crypto", async () => {
        failures.push(...(await refreshCacheJobs(GLOBAL_CACHE_JOBS)));
      });

      await runStep("finish", "Saving a fresh copy on this device", async () => {
        failures.push(...(await refreshCacheJobs(OTHER_CACHE_JOBS)));
      });

      setErrors(failures);
      if (failures.length > 0) {
        setMessage("Your main data is updated. A few optional feeds need another try.");
        toast.warning("Latest data loaded with a few feed warnings.");
      } else {
        setMessage("Everything is up to date.");
        toast.success("Latest market data is ready.");
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : "We could not refresh live data right now.";
      setMessage(text);
      setErrors((current) => [...current, text]);
      setSteps((current) =>
        current.map((step) => (step.state === "active" ? { ...step, state: "error" } : step))
      );
      toast.error(text);
    } finally {
      setRunning(false);
    }
  }

  async function runStep(id: string, activeMessage: string, work: () => Promise<unknown>) {
    setMessage(activeMessage);
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, state: "active" } : step))
    );
    await work();
    setSteps((current) =>
      current.map((step) => (step.id === id ? { ...step, state: "done" } : step))
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        disabled={running}
      >
        <RotateCw className={running ? "size-4 animate-spin" : "size-4"} />
        Refresh live data
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (running) return;
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="top-1/2 max-w-lg -translate-y-1/2 p-5 sm:max-w-xl sm:p-6">
          <DialogHeader>
            <DialogTitle>Refreshing live data</DialogTitle>
            <DialogDescription>
              We will refresh prices, portfolio screens, market pages, and the saved copy on this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last cached
              </p>
              <p className="mt-1 text-sm font-semibold">
                {cachedAt ? formatCacheTime(cachedAt) : "No saved dashboard cache yet"}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/25 px-4 py-6 text-center">
              <RefreshCw
                className={running ? "size-10 animate-spin text-primary" : "size-10 text-primary"}
              />
              <p className="mt-3 text-base font-semibold">{message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You can keep using the app while this runs.
              </p>
            </div>

            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <StepIcon state={step.state} />
                  <span className="min-w-0 flex-1 text-sm">{step.label}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {step.state}
                  </span>
                </div>
              ))}
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {errors.slice(0, 3).map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={running}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={runRefresh}
                disabled={running}
              >
                <RotateCw className={running ? "size-4 animate-spin" : "size-4"} />
                Start refresh
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatCacheTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") return <CheckCircle2 className="size-4 text-gain" />;
  if (state === "error") return <XCircle className="size-4 text-loss" />;
  if (state === "active") return <RefreshCw className="size-4 animate-spin text-primary" />;
  return <span className="size-4 rounded-full border border-border bg-muted" />;
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
