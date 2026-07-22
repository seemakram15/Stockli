"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  RefreshStatusDialog,
  type RefreshAccent,
  type RefreshDialogPhase,
  type RefreshStatusStep,
} from "@/components/refresh/refresh-status-dialog";

export type RefreshJob = {
  id: string;
  label: string;
  /** Optional live detail while this step runs. */
  detail?: string;
  /** If true, a failure stops the whole refresh. */
  critical?: boolean;
  run: () => Promise<string | void>;
};

export function useRefreshRunner({
  jobs,
  onComplete,
}: {
  jobs: RefreshJob[];
  onComplete?: (result: { impact: string | null; errors: string[] }) => void;
}) {
  const [phase, setPhase] = React.useState<RefreshDialogPhase>("ready");
  const [headline, setHeadline] = React.useState("Ready to pull the latest data.");
  const [steps, setSteps] = React.useState<RefreshStatusStep[]>(() =>
    jobs.map((job) => ({ id: job.id, label: job.label, state: "pending" as const }))
  );
  const [impact, setImpact] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const jobsRef = React.useRef(jobs);
  jobsRef.current = jobs;

  const reset = React.useCallback(() => {
    const nextJobs = jobsRef.current;
    setPhase("ready");
    setHeadline("Ready to pull the latest data.");
    setSteps(nextJobs.map((job) => ({ id: job.id, label: job.label, state: "pending" })));
    setImpact(null);
    setErrors([]);
  }, []);

  const run = React.useCallback(async () => {
    const nextJobs = jobsRef.current;
    if (!nextJobs.length) return;
    setPhase("running");
    setErrors([]);
    setImpact(null);
    setSteps(nextJobs.map((job) => ({ id: job.id, label: job.label, state: "pending" })));

    const failures: string[] = [];
    let lastImpact: string | null = null;

    try {
      for (const job of nextJobs) {
        setHeadline(job.label);
        setSteps((current) =>
          current.map((step) =>
            step.id === job.id
              ? { ...step, state: "active", detail: job.detail ?? null }
              : step
          )
        );
        try {
          const note = await job.run();
          if (typeof note === "string" && note.trim()) lastImpact = note.trim();
          setSteps((current) =>
            current.map((step) =>
              step.id === job.id
                ? {
                    ...step,
                    state: "done",
                    detail: typeof note === "string" && note.trim() ? note.trim() : null,
                  }
                : step
            )
          );
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          failures.push(`${job.label}: ${text}`);
          setSteps((current) =>
            current.map((step) =>
              step.id === job.id ? { ...step, state: "error", detail: text } : step
            )
          );
          if (job.critical) throw error;
        }
      }

      setErrors(failures);
      setImpact(lastImpact);
      setPhase(failures.length === nextJobs.length ? "error" : "done");
      if (failures.length === nextJobs.length) {
        setHeadline("Refresh could not finish.");
        toast.error("Refresh failed. Try again in a moment.");
      } else if (failures.length > 0) {
        setHeadline("Updated with a few warnings.");
        toast.warning(lastImpact ?? "Latest data loaded with warnings.");
      } else {
        setHeadline(lastImpact ?? "Everything is up to date.");
        toast.success(lastImpact ?? "Latest data is ready.");
      }
      onComplete?.({ impact: lastImpact, errors: failures });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Refresh failed.";
      setPhase("error");
      setHeadline(text);
      setErrors([text]);
      toast.error(text);
    }
  }, [onComplete]);

  return {
    phase,
    headline,
    steps,
    impact,
    errors,
    running: phase === "running",
    reset,
    run,
  };
}

export function withFreshParam(url: string) {
  const join = url.includes("?") ? "&" : "?";
  if (url.includes("fresh=")) return url;
  return `${url}${join}fresh=1`;
}

export type { RefreshAccent };
