"use client";

import * as React from "react";
import {
  Check,
  LayoutDashboard,
  LineChart,
  Loader2,
  ImageIcon,
  Sparkles,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { IconChip, type Accent } from "@/components/ui/accent";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/logo";
import { companyIconPath } from "@/lib/company-icons";
import { writePersistentResourceCache } from "@/lib/hooks/use-persistent-resource";
import { IMPORTANT_PRODUCT_UPDATES } from "@/lib/product-updates";
import { cn } from "@/lib/utils";

/** Set by the sign-in form right before the auth request; consumed once here. */
export const ACCOUNT_WARMUP_FLAG = "stockli:account-warmup";

/** Hard UI budget — never trap the user longer than this. */
const HARD_CLOSE_MS = 10_000;
/** Soft budget for in-flight work before we mark remaining steps skipped. */
const WORK_BUDGET_MS = 8_500;
/** Cap symbols warmed for fundamentals / icons (portfolio + watchlist). */
const SYMBOL_LIMIT = 16;
const FUNDAMENTALS_LIMIT = 8;

type Job = { cacheKey: string; url: string };

type StepId = "dashboard" | "market" | "fundamentals" | "icons";

type Step = {
  id: StepId;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: Accent;
};

const STEPS: Step[] = [
  {
    id: "dashboard",
    label: "Preparing your dashboard",
    hint: "Portfolios & holdings snapshot",
    icon: LayoutDashboard,
    accent: "emerald",
  },
  {
    id: "market",
    label: "Caching market data",
    hint: "PSX board for instant open",
    icon: LineChart,
    accent: "sky",
  },
  {
    id: "fundamentals",
    label: "Warming your stocks",
    hint: "Fundamentals for holdings",
    icon: Sparkles,
    accent: "teal",
  },
  {
    id: "icons",
    label: "Saving company icons",
    hint: "Logos cached for later lists",
    icon: ImageIcon,
    accent: "amber",
  },
];

type Status = "pending" | "loading" | "done" | "error";

type PortfoliosPayload = {
  holdings?: Array<{ symbol?: string | null }>;
};

type DashboardPayload = {
  dashboard?: {
    holdings?: Array<{ symbol?: string | null }>;
    portfolios?: unknown[];
  };
};

/**
 * Post-sign-in overlay: warms high-ROI caches within ~8–10s, shows curated
 * product updates, and never blocks past the hard close timer.
 */
export function AccountWarmup({
  userId,
  demo = false,
}: {
  userId: string;
  demo?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [statuses, setStatuses] = React.useState<Record<StepId, Status>>({
    dashboard: "pending",
    market: "pending",
    fundamentals: "pending",
    icons: "pending",
  });
  const [budgetHit, setBudgetHit] = React.useState(false);

  React.useEffect(() => {
    let armed = false;
    try {
      armed = window.sessionStorage.getItem(ACCOUNT_WARMUP_FLAG) === "1";
      if (armed) window.sessionStorage.removeItem(ACCOUNT_WARMUP_FLAG);
    } catch {
      armed = false;
    }
    if (!armed) return;

    setOpen(true);
    setStatuses({
      dashboard: "pending",
      market: "pending",
      fundamentals: "pending",
      icons: "pending",
    });
    setBudgetHit(false);

    let cancelled = false;
    let autoCloseTimer: number | undefined;
    const controller = new AbortController();

    const hardCloseTimer = window.setTimeout(() => {
      if (!cancelled) setOpen(false);
    }, HARD_CLOSE_MS);

    const budgetTimer = window.setTimeout(() => {
      if (cancelled) return;
      setBudgetHit(true);
      controller.abort();
      setStatuses((prev) => {
        const next = { ...prev };
        for (const step of STEPS) {
          if (next[step.id] === "pending" || next[step.id] === "loading") {
            next[step.id] = "error";
          }
        }
        return next;
      });
      autoCloseTimer = window.setTimeout(() => {
        if (!cancelled) setOpen(false);
      }, 900);
    }, WORK_BUDGET_MS);

    void (async () => {
      if (demo) {
        for (const step of STEPS) {
          if (cancelled) return;
          setStatuses((prev) => ({ ...prev, [step.id]: "loading" }));
          await sleep(90);
          if (cancelled) return;
          setStatuses((prev) => ({ ...prev, [step.id]: "done" }));
        }
        if (!cancelled) {
          autoCloseTimer = window.setTimeout(() => setOpen(false), 700);
        }
        return;
      }

      try {
        await runWarmup({
          userId,
          signal: controller.signal,
          setStatus: (id, status) => {
            if (!cancelled) setStatuses((prev) => ({ ...prev, [id]: status }));
          },
        });
      } catch {
        // Individual steps already record errors; ignore aggregate failures.
      }

      if (cancelled || controller.signal.aborted) return;
      autoCloseTimer = window.setTimeout(() => setOpen(false), 900);
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
      window.clearTimeout(hardCloseTimer);
      window.clearTimeout(budgetTimer);
    };
  }, [demo, userId]);

  if (!open) return null;

  const values = Object.values(statuses);
  const completed = values.filter((s) => s === "done" || s === "error").length;
  const allDone = values.length > 0 && completed === values.length;
  const pct = values.length ? Math.round((completed / values.length) * 100) : 0;
  const continueReady = allDone || budgetHit;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Setting up your account"
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-gradient-brand p-6 shadow-soft-lg sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-brand-mesh opacity-70" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-3">
            <IconChip accent="primary" variant="gradient" size="lg">
              <BrandMark pair="green" className="size-7" />
            </IconChip>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight">
                Setting up your <span className="text-gradient-emerald">account</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Warming the screens you open first — usually under 10 seconds.
              </p>
            </div>
          </div>

          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500"
              style={{ width: `${Math.max(8, pct)}%` }}
            />
          </div>

          <ul className="mt-4 space-y-2">
            {STEPS.map((step) => {
              const status = statuses[step.id] ?? "pending";
              return (
                <li
                  key={step.id}
                  className="flex items-center gap-3 rounded-xl bg-card/70 p-2.5 ring-1 ring-border backdrop-blur"
                >
                  <IconChip accent={step.accent} size="sm">
                    <step.icon />
                  </IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{step.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{step.hint}</p>
                  </div>
                  <StatusGlyph status={status} />
                </li>
              );
            })}
          </ul>

          <div className="mt-4 rounded-xl bg-card/60 p-3 ring-1 ring-border/80">
            <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Megaphone className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              Important updates
            </p>
            <ul className="space-y-2">
              {IMPORTANT_PRODUCT_UPDATES.slice(0, 3).map((update) => (
                <li key={update.id} className="text-sm">
                  <p className="font-medium leading-snug">{update.title}</p>
                  <p className="text-xs text-muted-foreground">{update.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {continueReady
                ? budgetHit && !allDone
                  ? "Ready — remaining work continues quietly."
                  : "All set — you're ready to go."
                : "Caching to your device…"}
            </p>
            <Button
              type="button"
              variant={continueReady ? "default" : "ghost"}
              size="sm"
              onClick={() => setOpen(false)}
              className={cn(
                continueReady && "bg-gradient-to-r from-emerald-500 to-teal-400 text-white"
              )}
            >
              {continueReady ? "Continue" : "Skip"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function runWarmup({
  userId,
  signal,
  setStatus,
}: {
  userId: string;
  signal: AbortSignal;
  setStatus: (id: StepId, status: Status) => void;
}) {
  const symbolBag = { current: [] as string[] };

  const dashboardTask = (async () => {
    setStatus("dashboard", "loading");
    try {
      const [dashboard, portfolios, watchlist] = await Promise.all([
        fetchJsonJob(
          {
            cacheKey: `private:dashboard:${userId}`,
            url: "/api/private/dashboard",
          },
          signal
        ),
        fetchJsonJob(
          {
            cacheKey: `private:portfolios:${userId}`,
            url: "/api/private/portfolios",
          },
          signal
        ),
        fetchJson<{ symbols?: string[] }>("/api/private/watchlist", signal).catch(() => null),
      ]);
      symbolBag.current = collectSymbols(dashboard, portfolios, watchlist?.symbols);
      setStatus("dashboard", "done");
    } catch {
      setStatus("dashboard", "error");
    }
  })();

  const marketTask = (async () => {
    setStatus("market", "loading");
    try {
      await fetchJsonJob(
        { cacheKey: "public:psx-market:v3", url: "/api/public/market" },
        signal
      );
      setStatus("market", "done");
    } catch {
      setStatus("market", "error");
    }
  })();

  // Kick a light backend warmup in parallel (non-blocking for UI steps).
  void fetch("/api/background/warmup", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ scope: "backend-only" }),
    signal,
  }).catch(() => undefined);

  await Promise.all([dashboardTask, marketTask]);
  if (signal.aborted) return;

  const symbols = symbolBag.current.slice(0, SYMBOL_LIMIT);

  const fundamentalsTask = (async () => {
    setStatus("fundamentals", "loading");
    try {
      if (symbols.length === 0) {
        setStatus("fundamentals", "done");
        return;
      }
      const targets = symbols.slice(0, FUNDAMENTALS_LIMIT);
      await mapPool(targets, 3, async (symbol) => {
        if (signal.aborted) return;
        await Promise.allSettled([
          fetchJsonJob(
            {
              cacheKey: `public:stock-financials:v4:${symbol}`,
              url: `/api/public/stock-financials/${encodeURIComponent(symbol)}`,
            },
            signal
          ),
          fetchJsonJob(
            {
              cacheKey: `public:stock-overview:v3:${symbol}`,
              url: `/api/public/stock-overview/${encodeURIComponent(symbol)}`,
            },
            signal
          ),
          fetchJsonJob(
            {
              cacheKey: `private:stock:${userId}:${symbol}`,
              url: `/api/private/stocks/${encodeURIComponent(symbol)}`,
            },
            signal
          ),
        ]);
      });
      if (!signal.aborted) setStatus("fundamentals", "done");
    } catch {
      if (!signal.aborted) setStatus("fundamentals", "error");
    }
  })();

  const iconsTask = (async () => {
    setStatus("icons", "loading");
    try {
      if (symbols.length === 0) {
        // Still warm the ready company directory so search/analyzer icons resolve.
        await fetchJsonJob(
          {
            cacheKey: "public:stock-fundamentals:companies:ready:v1",
            url: "/api/public/stock-fundamentals/companies?ready=1",
          },
          signal
        ).catch(() => undefined);
        if (!signal.aborted) setStatus("icons", "done");
        return;
      }

      await Promise.allSettled([
        fetch("/api/public/company-icons/warm", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          body: JSON.stringify({ symbols, budgetMs: 6_500 }),
          signal,
        }),
        mapPool(symbols, 6, async (symbol) => {
          if (signal.aborted) return;
          await fetch(companyIconPath(symbol), { signal, cache: "force-cache" }).catch(
            () => undefined
          );
        }),
      ]);
      if (!signal.aborted) setStatus("icons", "done");
    } catch {
      if (!signal.aborted) setStatus("icons", "error");
    }
  })();

  await Promise.all([fundamentalsTask, iconsTask]);
}

async function fetchJsonJob(job: Job, signal: AbortSignal): Promise<unknown> {
  const data = await fetchJson<unknown>(job.url, signal);
  await writePersistentResourceCache(job.cacheKey, data);
  return data;
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

function collectSymbols(
  dashboard: unknown,
  portfolios: unknown,
  watchlistSymbols?: string[] | null
): string[] {
  const seen = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const symbol = value.trim().toUpperCase();
    if (/^[A-Z0-9]{1,12}$/.test(symbol)) seen.add(symbol);
  };

  const dash = dashboard as DashboardPayload | null;
  for (const holding of dash?.dashboard?.holdings ?? []) push(holding.symbol);

  const pf = portfolios as PortfoliosPayload | null;
  for (const holding of pf?.holdings ?? []) push(holding.symbol);

  for (const symbol of watchlistSymbols ?? []) push(symbol);

  return Array.from(seen);
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function StatusGlyph({ status }: { status: Status }) {
  if (status === "done") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gain/15 text-gain">
        <Check className="size-3.5" />
      </span>
    );
  }
  if (status === "error") {
    return <span className="shrink-0 text-xs font-medium text-muted-foreground">skipped</span>;
  }
  if (status === "loading") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" />;
  }
  return <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />;
}
