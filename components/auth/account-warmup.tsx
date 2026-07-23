"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  Gift,
  History,
  Link2,
  LineChart,
  Loader2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { IconChip, type Accent } from "@/components/ui/accent";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/logo";
import { writePersistentResourceCache } from "@/lib/hooks/use-persistent-resource";
import { cn } from "@/lib/utils";

/** Set by the sign-in form right before the auth request; consumed once here. */
export const ACCOUNT_WARMUP_FLAG = "stockli:account-warmup";

type Job = { cacheKey: string; url: string };
type Task = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: Accent;
  jobs: Job[];
};

/**
 * The pages we pre-load into the device cache the moment a user signs in, so
 * they open instantly afterwards (cache keys match exactly what each page reads).
 */
const TASKS: Task[] = [
  {
    id: "analyzer",
    label: "Stock analyzer",
    hint: "Company list & market snapshot",
    icon: LineChart,
    accent: "violet",
    jobs: [
      {
        cacheKey: "public:stock-fundamentals:companies:ready:v1",
        url: "/api/public/stock-fundamentals/companies?ready=1",
      },
      { cacheKey: "public:psx-market:v3", url: "/api/public/market" },
    ],
  },
  {
    id: "useful-links",
    label: "Useful links",
    hint: "Research & economy resources",
    icon: Link2,
    accent: "indigo",
    jobs: [{ cacheKey: "public:useful-links:v2", url: "/api/public/useful-links" }],
  },
  {
    id: "board-meetings",
    label: "Board meetings",
    hint: "Upcoming corporate calendar",
    icon: CalendarDays,
    accent: "sky",
    jobs: [{ cacheKey: "public:board-meetings", url: "/api/public/board-meetings" }],
  },
  {
    id: "book-closures",
    label: "Book closures",
    hint: "Entitlement & rights dates",
    icon: Gift,
    accent: "amber",
    jobs: [{ cacheKey: "public:book-closures", url: "/api/public/book-closures" }],
  },
  {
    id: "dividend-history",
    label: "Dividend history",
    hint: "Latest payout records",
    icon: History,
    accent: "emerald",
    jobs: [{ cacheKey: "public:dividend-history", url: "/api/public/dividend-history" }],
  },
];

type Status = "pending" | "loading" | "done" | "error";

async function runJob(job: Job): Promise<void> {
  const res = await fetch(job.url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const json = (await res.json()) as { data: unknown };
  await writePersistentResourceCache(job.cacheKey, json.data);
}

/**
 * "Setting your account" overlay shown once right after sign-in. It warms the
 * device cache for the heaviest secondary pages while the user lands on the
 * dashboard, then dismisses itself. Mounted in the authenticated app layout.
 */
export function AccountWarmup() {
  const [open, setOpen] = React.useState(false);
  const [statuses, setStatuses] = React.useState<Record<string, Status>>({});

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
    setStatuses(Object.fromEntries(TASKS.map((task) => [task.id, "pending"])));

    let cancelled = false;
    let autoCloseTimer: number | undefined;

    // Safety net: never trap the user behind the overlay if an endpoint stalls.
    const hardCloseTimer = window.setTimeout(() => {
      if (!cancelled) setOpen(false);
    }, 15_000);

    void Promise.all(
      TASKS.map(async (task) => {
        if (cancelled) return;
        setStatuses((prev) => ({ ...prev, [task.id]: "loading" }));
        try {
          await Promise.all(task.jobs.map(runJob));
          if (!cancelled) setStatuses((prev) => ({ ...prev, [task.id]: "done" }));
        } catch {
          if (!cancelled) setStatuses((prev) => ({ ...prev, [task.id]: "error" }));
        }
      })
    ).finally(() => {
      if (cancelled) return;
      autoCloseTimer = window.setTimeout(() => setOpen(false), 1100);
    });

    return () => {
      cancelled = true;
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
      window.clearTimeout(hardCloseTimer);
    };
  }, []);

  if (!open) return null;

  const values = Object.values(statuses);
  const completed = values.filter((s) => s === "done" || s === "error").length;
  const allDone = values.length > 0 && completed === values.length;
  const pct = values.length ? Math.round((completed / values.length) * 100) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Setting your account"
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
                Setting your <span className="text-gradient-emerald">account</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                Getting your workspace ready for instant access…
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
            {TASKS.map((task) => {
              const status = statuses[task.id] ?? "pending";
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl bg-card/70 p-2.5 ring-1 ring-border backdrop-blur"
                >
                  <IconChip accent={task.accent} size="sm">
                    <task.icon />
                  </IconChip>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{task.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{task.hint}</p>
                  </div>
                  <StatusGlyph status={status} />
                </li>
              );
            })}
          </ul>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              {allDone ? "All set — you're ready to go." : "Caching to your device…"}
            </p>
            <Button
              type="button"
              variant={allDone ? "default" : "ghost"}
              size="sm"
              onClick={() => setOpen(false)}
              className={cn(allDone && "bg-gradient-to-r from-emerald-500 to-teal-400 text-white")}
            >
              {allDone ? "Continue" : "Skip"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
