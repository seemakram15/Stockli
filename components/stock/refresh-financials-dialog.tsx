"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconChip } from "@/components/ui/accent";
import { cn } from "@/lib/utils";
import {
  STOCK_FINANCIALS_REFRESH_STEPS,
  type StockFinancialsData,
  type StockFinancialsRefreshProgress,
  type StockFinancialsRefreshStepId,
  type StockFinancialsRefreshStepStatus,
} from "@/lib/types/stock-fundamentals";

type StepState = {
  id: StockFinancialsRefreshStepId;
  message: string;
  status: StockFinancialsRefreshStepStatus;
  detail?: string;
};

type RefreshResultPayload = {
  data: StockFinancialsData;
  refresh: {
    usedFallback: boolean;
    hadMeaningfulFreshData: boolean;
    complete: boolean;
    missingTabs: string[];
  };
  cache: {
    status: string;
    storedAt: string;
  };
  warning: string | null;
};

function initialSteps(startActive = false): StepState[] {
  return STOCK_FINANCIALS_REFRESH_STEPS.map((step, index) => ({
    id: step.id,
    message: step.message,
    status: startActive && index === 0 ? ("active" as const) : ("pending" as const),
  }));
}

const STEP_UNAVAILABLE_DETAIL = "Data not available yet";

function sanitizeUserFacingCopy(text: string): string {
  const withoutProvider = text.replace(/\bAskAnalyst\b/gi, "").replace(/\s{2,}/g, " ").trim();
  if (
    /Fundamental data could not be refreshed/i.test(text) ||
    /No rows returned/i.test(text) ||
    /Cached data will be used when available/i.test(text)
  ) {
    return STEP_UNAVAILABLE_DETAIL;
  }
  return withoutProvider
    .replace(/\s+from\s+\./gi, ".")
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

function stepDetailForProgress(progress: StockFinancialsRefreshProgress): string | undefined {
  if (progress.status === "error") {
    return STEP_UNAVAILABLE_DETAIL;
  }
  if (!progress.detail) return undefined;
  const cleaned = sanitizeUserFacingCopy(progress.detail);
  return cleaned || undefined;
}

export function RefreshFinancialsDialog({
  open,
  onOpenChange,
  symbol,
  companyName,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  companyName?: string | null;
  onSuccess: (payload: RefreshResultPayload) => void | Promise<void>;
}) {
  const [steps, setSteps] = React.useState<StepState[]>(initialSteps);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [finished, setFinished] = React.useState(false);
  const runIdRef = React.useRef(0);

  const onSuccessRef = React.useRef(onSuccess);
  React.useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const applyProgress = React.useCallback((progress: StockFinancialsRefreshProgress) => {
    setSteps((current) =>
      current.map((step) =>
        step.id === progress.stepId
          ? {
              ...step,
              status: progress.status,
              message: progress.message || step.message,
              detail: stepDetailForProgress(progress),
            }
          : progress.status === "active" && step.status === "active" && step.id !== progress.stepId
            ? { ...step, status: "pending" as const }
            : step
      )
    );
  }, []);

  const runRefresh = React.useCallback(async () => {
    const runId = ++runIdRef.current;
    setRunning(true);
    setError(null);
    setWarning(null);
    setFinished(false);
    setSteps(initialSteps(true));

    try {
      const response = await fetch(
        `/api/public/stock-financials/${encodeURIComponent(symbol)}/refresh?stream=1`,
        {
          method: "POST",
          headers: {
            accept: "application/x-ndjson",
          },
          cache: "no-store",
        }
      );

      if (!response.ok && !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(
          sanitizeUserFacingCopy(payload?.error ?? `Refresh failed (${response.status})`)
        );
      }

      if (!response.body) {
        throw new Error("Refresh stream unavailable.");
      }

      // Non-stream error responses (401/429/etc.) still have a body; parse JSON when not NDJSON.
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/x-ndjson")) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(
            sanitizeUserFacingCopy(payload?.error ?? `Refresh failed (${response.status})`)
          );
        }
        throw new Error("Refresh stream was not returned.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: RefreshResultPayload | null = null;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (runId !== runIdRef.current) {
          reader.cancel().catch(() => undefined);
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let event: unknown;
          try {
            event = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (!event || typeof event !== "object") continue;
          const typed = event as {
            type?: string;
            error?: string;
            stepId?: StockFinancialsRefreshStepId;
            status?: StockFinancialsRefreshStepStatus;
            message?: string;
            detail?: string;
            data?: StockFinancialsData;
            refresh?: RefreshResultPayload["refresh"];
            cache?: RefreshResultPayload["cache"];
            warning?: string | null;
          };

          if (typed.type === "progress" && typed.stepId && typed.status && typed.message) {
            applyProgress({
              stepId: typed.stepId,
              status: typed.status,
              message: typed.message,
              detail: typed.detail,
            });
            continue;
          }

          if (typed.type === "error") {
            streamError = sanitizeUserFacingCopy(
              typed.error ?? "Fresh fundamentals could not be fetched right now."
            );
            continue;
          }

          if (typed.type === "result" && typed.data && typed.refresh && typed.cache) {
            result = {
              data: typed.data,
              refresh: typed.refresh,
              cache: typed.cache,
              warning: typed.warning ? sanitizeUserFacingCopy(typed.warning) : null,
            };
          }
        }
      }

      if (runId !== runIdRef.current) return;

      if (streamError) {
        throw new Error(streamError);
      }
      if (!result) {
        throw new Error("Refresh finished without a snapshot.");
      }

      setWarning(result.warning);
      setFinished(true);
      await onSuccessRef.current(result);
    } catch (fetchError) {
      if (runId !== runIdRef.current) return;
      const message = sanitizeUserFacingCopy(
        fetchError instanceof Error
          ? fetchError.message
          : "Fresh fundamentals could not be fetched right now."
      );
      setError(message);
      setSteps((current) => {
        const activeIndex = current.findIndex((step) => step.status === "active");
        if (activeIndex < 0) {
          return current.map((step, index) =>
            index === 0 ? { ...step, status: "error", detail: STEP_UNAVAILABLE_DETAIL } : step
          );
        }
        return current.map((step, index) =>
          index === activeIndex
            ? { ...step, status: "error", detail: STEP_UNAVAILABLE_DETAIL }
            : step
        );
      });
    } finally {
      if (runId === runIdRef.current) setRunning(false);
    }
  }, [applyProgress, symbol]);

  React.useEffect(() => {
    if (!open) {
      runIdRef.current += 1;
      setRunning(false);
      setError(null);
      setWarning(null);
      setFinished(false);
      setSteps(initialSteps());
      return;
    }
    void runRefresh();
  }, [open, runRefresh]);

  const titleName = companyName?.trim() || symbol;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-5 pr-12">
          <div className="flex items-start gap-3">
            <IconChip accent="sky" variant="gradient" size="lg">
              {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            </IconChip>
            <div className="min-w-0">
              <DialogTitle>Refreshing {symbol} snapshot</DialogTitle>
              <DialogDescription>
                Updating fundamentals for {titleName} and saving the snapshot when data is
                available.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <ol className="space-y-2.5">
            {steps.map((step) => (
              <li
                key={step.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-2.5",
                  step.status === "active" && "border-sky-500/30 bg-sky-500/5",
                  step.status === "done" && "border-emerald-500/20 bg-emerald-500/5",
                  step.status === "error" && "border-rose-500/30 bg-rose-500/5",
                  step.status === "pending" && "border-border/70 bg-background"
                )}
              >
                <StepIcon status={step.status} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.status === "pending" ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {step.message}
                  </p>
                  {step.detail ? (
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        step.status === "error" ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground"
                      )}
                    >
                      {step.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          {!error && warning ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200">
              {warning}
            </div>
          ) : null}

          {!error && finished && !warning ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
              Snapshot saved. Fundamentals on this page are up to date.
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t px-5 py-4">
          {error ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Dismiss
              </Button>
              <Button type="button" onClick={() => void runRefresh()} disabled={running}>
                <RefreshCw className={cn("size-4", running && "animate-spin")} />
                Retry
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant={finished ? "default" : "outline"}
              onClick={() => onOpenChange(false)}
              disabled={running}
            >
              {finished ? "Done" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepIcon({ status }: { status: StockFinancialsRefreshStepStatus }) {
  if (status === "active") {
    return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-sky-600 dark:text-sky-400" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === "error") {
    return <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" />;
  }
  return <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />;
}
