"use client";

import * as React from "react";
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Radio,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RefreshStepState = "pending" | "active" | "done" | "error" | "skipped";

export interface RefreshStatusStep {
  id: string;
  label: string;
  detail?: string | null;
  state: RefreshStepState;
}

export type RefreshDialogPhase = "ready" | "running" | "done" | "error";

const ACCENT = {
  emerald: {
    glow: "from-emerald-500/25 via-teal-500/10 to-transparent",
    ring: "ring-emerald-500/20",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
    soft: "bg-emerald-500/10",
  },
  violet: {
    glow: "from-violet-500/25 via-fuchsia-500/10 to-transparent",
    ring: "ring-violet-500/20",
    chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
    soft: "bg-violet-500/10",
  },
  sky: {
    glow: "from-sky-500/25 via-cyan-500/10 to-transparent",
    ring: "ring-sky-500/20",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
    soft: "bg-sky-500/10",
  },
  amber: {
    glow: "from-amber-500/25 via-orange-500/10 to-transparent",
    ring: "ring-amber-500/20",
    chip: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
    bar: "bg-amber-500",
    soft: "bg-amber-500/10",
  },
  orange: {
    glow: "from-orange-500/25 via-amber-500/10 to-transparent",
    ring: "ring-orange-500/20",
    chip: "bg-orange-500/15 text-orange-800 dark:text-orange-300",
    bar: "bg-orange-500",
    soft: "bg-orange-500/10",
  },
  rose: {
    glow: "from-rose-500/25 via-pink-500/10 to-transparent",
    ring: "ring-rose-500/20",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
    soft: "bg-rose-500/10",
  },
  indigo: {
    glow: "from-indigo-500/25 via-violet-500/10 to-transparent",
    ring: "ring-indigo-500/20",
    chip: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    bar: "bg-indigo-500",
    soft: "bg-indigo-500/10",
  },
  cyan: {
    glow: "from-cyan-500/25 via-sky-500/10 to-transparent",
    ring: "ring-cyan-500/20",
    chip: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
    bar: "bg-cyan-500",
    soft: "bg-cyan-500/10",
  },
} as const;

export type RefreshAccent = keyof typeof ACCENT;

export function RefreshStatusDialog({
  open,
  onOpenChange,
  title,
  description,
  accent = "violet",
  phase,
  headline,
  steps,
  impact,
  errors = [],
  onStart,
  startLabel = "Start refresh",
  closeLabel = "Done",
  autoCloseMs = 1600,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  accent?: RefreshAccent;
  phase: RefreshDialogPhase;
  headline: string;
  steps: RefreshStatusStep[];
  impact?: string | null;
  errors?: string[];
  onStart?: () => void;
  startLabel?: string;
  closeLabel?: string;
  autoCloseMs?: number;
}) {
  const theme = ACCENT[accent] ?? ACCENT.violet;
  const running = phase === "running";
  const doneOk = phase === "done" && errors.length === 0;
  const donePartial = phase === "done" && errors.length > 0;
  const failed = phase === "error";

  const completed = steps.filter((step) => step.state === "done" || step.state === "skipped").length;
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  const activeStep = steps.find((step) => step.state === "active");

  React.useEffect(() => {
    if (!open || phase !== "done" || errors.length > 0 || !autoCloseMs) return;
    const timer = window.setTimeout(() => onOpenChange(false), autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [autoCloseMs, errors.length, onOpenChange, open, phase]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          "overflow-hidden border-border/70 p-0 sm:max-w-lg",
          "shadow-2xl shadow-black/10 dark:shadow-black/40"
        )}
      >
        <div className={cn("relative overflow-hidden bg-gradient-to-br px-5 pb-4 pt-5 sm:px-6 sm:pt-6", theme.glow)}>
          <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-background/40 blur-2xl" />
          <DialogHeader className="relative space-y-3 text-left">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl ring-1",
                  theme.soft,
                  theme.ring
                )}
              >
                {doneOk ? (
                  <CheckCircle2 className="size-5 text-gain" />
                ) : failed ? (
                  <XCircle className="size-5 text-loss" />
                ) : donePartial ? (
                  <CircleAlert className="size-5 text-amber-600 dark:text-amber-400" />
                ) : running ? (
                  <Loader2 className="size-5 animate-spin text-foreground" />
                ) : (
                  <Radio className="size-5 text-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                    {title}
                  </DialogTitle>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", theme.chip)}>
                    {phaseLabel(phase, errors.length)}
                  </span>
                </div>
                {description ? (
                  <DialogDescription className="mt-1 text-sm leading-relaxed">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          <div className="relative mt-4 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{headline}</p>
                {activeStep?.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{activeStep.detail}</p>
                ) : impact && (doneOk || donePartial) ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 shrink-0 text-amber-500" />
                    {impact}
                  </p>
                ) : running ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Screens update as each step finishes.
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 tabular-nums text-sm font-semibold text-muted-foreground">
                {progress}%
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  failed ? "bg-loss" : theme.bar
                )}
                style={{ width: `${Math.max(phase === "ready" ? 0 : 8, progress)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 sm:px-6">
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                  step.state === "active" && "border-foreground/15 bg-muted/40",
                  step.state === "done" && "border-border/80 bg-background",
                  step.state === "error" && "border-loss/30 bg-loss/5",
                  step.state === "pending" && "border-transparent bg-muted/20"
                )}
              >
                <StepGlyph state={step.state} index={index + 1} />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      step.state === "pending" && "text-muted-foreground",
                      step.state === "error" && "text-loss"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.detail ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                  ) : null}
                </div>
                <span className="shrink-0 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {stepStateLabel(step.state)}
                </span>
              </div>
            ))}
          </div>

          {errors.length > 0 ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100">
              <p className="mb-1 flex items-center gap-1.5 font-semibold">
                <CircleAlert className="size-3.5" />
                Needs attention
              </p>
              {errors.slice(0, 4).map((error) => (
                <p key={error} className="leading-relaxed opacity-90">
                  {error}
                </p>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Activity className="size-3.5" />
              Live feeds · no stale cache
            </p>
            <div className="flex gap-2">
              {!running ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  {phase === "ready" ? "Cancel" : closeLabel}
                </Button>
              ) : null}
              {phase === "ready" && onStart ? (
                <Button type="button" onClick={onStart}>
                  <RefreshCw className="size-4" />
                  {startLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function phaseLabel(phase: RefreshDialogPhase, errorCount: number) {
  if (phase === "running") return "Live";
  if (phase === "ready") return "Ready";
  if (phase === "error") return "Failed";
  if (errorCount > 0) return "Partial";
  return "Updated";
}

function stepStateLabel(state: RefreshStepState) {
  if (state === "active") return "Now";
  if (state === "done") return "Done";
  if (state === "error") return "Error";
  if (state === "skipped") return "Skip";
  return "Wait";
}

function StepGlyph({ state, index }: { state: RefreshStepState; index: number }) {
  if (state === "done") {
    return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-gain" />;
  }
  if (state === "error") {
    return <XCircle className="mt-0.5 size-4 shrink-0 text-loss" />;
  }
  if (state === "active") {
    return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-foreground" />;
  }
  return (
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted-foreground">
      {index}
    </span>
  );
}
