"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import {
  RefreshStatusDialog,
  type RefreshAccent,
} from "@/components/refresh/refresh-status-dialog";
import {
  useRefreshRunner,
  withFreshParam,
  type RefreshJob,
} from "@/lib/hooks/use-refresh-runner";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  emerald: {
    btn: "bg-gradient-to-r from-emerald-500 to-green-400 shadow-emerald-500/30 hover:shadow-emerald-500/50",
    accent: "emerald" as RefreshAccent,
  },
  sky: {
    btn: "bg-gradient-to-r from-sky-500 to-blue-400 shadow-sky-500/30 hover:shadow-sky-500/50",
    accent: "sky" as RefreshAccent,
  },
  violet: {
    btn: "bg-gradient-to-r from-violet-500 to-fuchsia-400 shadow-violet-500/30 hover:shadow-violet-500/50",
    accent: "violet" as RefreshAccent,
  },
  amber: {
    btn: "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-amber-500/30 hover:shadow-amber-500/50",
    accent: "amber" as RefreshAccent,
  },
  orange: {
    btn: "bg-gradient-to-r from-orange-500 to-amber-400 shadow-orange-500/30 hover:shadow-orange-500/50",
    accent: "orange" as RefreshAccent,
  },
  rose: {
    btn: "bg-gradient-to-r from-rose-500 to-pink-400 shadow-rose-500/30 hover:shadow-rose-500/50",
    accent: "rose" as RefreshAccent,
  },
  indigo: {
    btn: "bg-gradient-to-r from-indigo-500 to-violet-400 shadow-indigo-500/30 hover:shadow-indigo-500/50",
    accent: "indigo" as RefreshAccent,
  },
  cyan: {
    btn: "bg-gradient-to-r from-cyan-500 to-sky-400 shadow-cyan-500/30 hover:shadow-cyan-500/50",
    accent: "cyan" as RefreshAccent,
  },
} as const;

export type RefreshColor = keyof typeof COLOR_MAP;

/**
 * Page refresh control with a real status dialog.
 *
 * Prefer `jobs` for accurate step-by-step updates. The legacy `onRefresh` +
 * `stages` API still works: stages become labeled steps around one real fetch.
 */
export function MarketRefreshButton({
  onRefresh,
  jobs,
  color = "emerald",
  label = "Refresh",
  title,
  description,
  stages,
  size = "sm",
  className,
  autoStart = true,
}: {
  onRefresh?: () => Promise<string | void>;
  jobs?: RefreshJob[];
  color?: RefreshColor;
  label?: string;
  title?: string;
  description?: string;
  stages?: string[];
  size?: "sm" | "default";
  className?: string;
  /** Open dialog and start immediately (default). */
  autoStart?: boolean;
}) {
  const style = COLOR_MAP[color];
  const [open, setOpen] = React.useState(false);

  const resolvedJobs = React.useMemo(() => {
    if (jobs?.length) return jobs;
    if (!onRefresh) return [];
    const labels = stages?.length
      ? stages
      : ["Connecting to live feed", "Fetching latest data", "Updating this screen"];
    let impact: string | void;
    return labels.map((stepLabel, index) => ({
      id: `stage-${index}`,
      label: stepLabel,
      run: async () => {
        if (index === 0) {
          impact = await onRefresh();
          return typeof impact === "string" ? impact : undefined;
        }
        return typeof impact === "string" ? impact : "Screen updated";
      },
    }));
  }, [jobs, onRefresh, stages]);

  const runner = useRefreshRunner({ jobs: resolvedJobs });

  async function handleClick() {
    if (runner.running) return;
    runner.reset();
    setOpen(true);
    if (autoStart) {
      // Let the dialog paint before the first await.
      window.setTimeout(() => {
        void runner.run();
      }, 40);
    }
  }

  const btnBase = cn(
    "inline-flex items-center gap-1.5 rounded-lg font-semibold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
    style.btn,
    className
  );

  const phaseIcon =
    runner.phase === "done" && runner.errors.length === 0 ? (
      <>
        <CheckCircle2 className="size-4 shrink-0" />
        <span>Updated</span>
      </>
    ) : runner.phase === "error" ? (
      <>
        <XCircle className="size-4 shrink-0" />
        <span>Failed</span>
      </>
    ) : (
      <>
        <RefreshCw className={cn("size-4 shrink-0", runner.running && "animate-spin")} />
        <span>{runner.running ? "Refreshing…" : label}</span>
      </>
    );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={runner.running}
        className={btnBase}
      >
        {open || runner.running || runner.phase === "done" || runner.phase === "error"
          ? phaseIcon
          : (
            <>
              <RefreshCw className="size-4 shrink-0" />
              <span>{label}</span>
            </>
          )}
      </button>

      <RefreshStatusDialog
        open={open}
        onOpenChange={(next) => {
          if (runner.running) return;
          setOpen(next);
          if (!next) runner.reset();
        }}
        title={title ?? label}
        description={
          description ??
          "Pulling fresh data from the live feed and rebuilding this screen — stale caches are cleared first."
        }
        accent={style.accent}
        phase={runner.phase}
        headline={runner.headline}
        steps={runner.steps}
        impact={runner.impact}
        errors={runner.errors}
        onStart={autoStart ? undefined : () => void runner.run()}
        startLabel="Refresh now"
      />
    </>
  );
}

/** Build standard 3-step jobs for a persistent resource page. */
export function resourceRefreshJobs<T>({
  refreshNow,
  freshUrl,
  labels,
  summarize,
  prepare,
}: {
  refreshNow: (options?: { url?: string }) => Promise<T>;
  freshUrl: string;
  labels: { prepare?: string; fetch: string; apply: string };
  summarize?: (data: T) => string | void;
  prepare?: () => Promise<void> | void;
}): RefreshJob[] {
  let snapshot: T | null = null;
  const jobs: RefreshJob[] = [];

  if (prepare || labels.prepare) {
    jobs.push({
      id: "prepare",
      label: labels.prepare ?? "Clearing stale caches",
      detail: "Bypassing saved snapshots on this device and the server",
      run: async () => {
        await prepare?.();
      },
    });
  }

  jobs.push({
    id: "fetch",
    label: labels.fetch,
    detail: "Requesting a forced live reload",
    run: async () => {
      snapshot = await refreshNow({ url: withFreshParam(freshUrl) });
      return summarize?.(snapshot) ?? undefined;
    },
  });

  jobs.push({
    id: "apply",
    label: labels.apply,
    detail: "Writing the latest snapshot onto this screen",
    run: async () => {
      if (!snapshot) snapshot = await refreshNow({ url: withFreshParam(freshUrl) });
      return summarize?.(snapshot) ?? "Screen updated";
    },
  });

  return jobs;
}
