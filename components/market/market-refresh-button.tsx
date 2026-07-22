"use client";

import * as React from "react";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const COLOR_MAP = {
  emerald: {
    btn: "bg-gradient-to-r from-emerald-500 to-green-400 shadow-emerald-500/30 hover:shadow-emerald-500/50",
    dot: "bg-emerald-400",
    pulse: "animate-pulse bg-emerald-400",
  },
  sky: {
    btn: "bg-gradient-to-r from-sky-500 to-blue-400 shadow-sky-500/30 hover:shadow-sky-500/50",
    dot: "bg-sky-400",
    pulse: "animate-pulse bg-sky-400",
  },
  violet: {
    btn: "bg-gradient-to-r from-violet-500 to-fuchsia-400 shadow-violet-500/30 hover:shadow-violet-500/50",
    dot: "bg-violet-400",
    pulse: "animate-pulse bg-violet-400",
  },
  amber: {
    btn: "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-amber-500/30 hover:shadow-amber-500/50",
    dot: "bg-amber-400",
    pulse: "animate-pulse bg-amber-400",
  },
  orange: {
    btn: "bg-gradient-to-r from-orange-500 to-amber-400 shadow-orange-500/30 hover:shadow-orange-500/50",
    dot: "bg-orange-400",
    pulse: "animate-pulse bg-orange-400",
  },
  rose: {
    btn: "bg-gradient-to-r from-rose-500 to-pink-400 shadow-rose-500/30 hover:shadow-rose-500/50",
    dot: "bg-rose-400",
    pulse: "animate-pulse bg-rose-400",
  },
  indigo: {
    btn: "bg-gradient-to-r from-indigo-500 to-violet-400 shadow-indigo-500/30 hover:shadow-indigo-500/50",
    dot: "bg-indigo-400",
    pulse: "animate-pulse bg-indigo-400",
  },
  cyan: {
    btn: "bg-gradient-to-r from-cyan-500 to-sky-400 shadow-cyan-500/30 hover:shadow-cyan-500/50",
    dot: "bg-cyan-400",
    pulse: "animate-pulse bg-cyan-400",
  },
} as const;

export type RefreshColor = keyof typeof COLOR_MAP;

type Phase = "idle" | "loading" | "done" | "error";
type StageState = "pending" | "active" | "done" | "error";

interface StageItem {
  label: string;
  state: StageState;
}

export function MarketRefreshButton({
  onRefresh,
  color = "emerald",
  label = "Refresh",
  stages,
  size = "sm",
  className,
}: {
  onRefresh: () => Promise<string | void>;
  color?: RefreshColor;
  label?: string;
  stages?: string[];
  size?: "sm" | "default";
  className?: string;
}) {
  const style = COLOR_MAP[color];
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [impactText, setImpactText] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [stageItems, setStageItems] = React.useState<StageItem[]>([]);
  const timersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  React.useEffect(() => () => clearTimers(), []);

  async function handleClick() {
    if (phase === "loading") return;
    clearTimers();
    setPhase("loading");
    setImpactText(null);

    const hasDialog = stages && stages.length > 0;

    if (hasDialog) {
      const initial: StageItem[] = stages.map((label, i) => ({
        label,
        state: i === 0 ? "active" : "pending",
      }));
      setStageItems(initial);
      setDialogOpen(true);

      let currentIdx = 0;
      const advanceTo = (idx: number) => {
        currentIdx = idx;
        setStageItems((prev) =>
          prev.map((item, i) => ({
            ...item,
            state: i < idx ? "done" : i === idx ? "active" : "pending",
          }))
        );
      };

      for (let i = 1; i < stages.length - 1; i++) {
        const t = setTimeout(() => advanceTo(i), i * 750);
        timersRef.current.push(t);
      }

      try {
        const result = await onRefresh();
        clearTimers();
        if (typeof result === "string" && result) setImpactText(result);

        const lastIdx = stages.length - 1;
        advanceTo(lastIdx);

        const t1 = setTimeout(() => {
          setStageItems((prev) => prev.map((s) => ({ ...s, state: "done" })));
          setPhase("done");
          const t2 = setTimeout(() => {
            setDialogOpen(false);
            const t3 = setTimeout(() => setPhase("idle"), 300);
            timersRef.current.push(t3);
          }, 1400);
          timersRef.current.push(t2);
        }, 550);
        timersRef.current.push(t1);
      } catch {
        clearTimers();
        setStageItems((prev) =>
          prev.map((item, i) => ({
            ...item,
            state:
              i < currentIdx ? "done" : i === currentIdx ? "error" : "pending",
          }))
        );
        setPhase("error");
        const t = setTimeout(() => {
          setDialogOpen(false);
          setTimeout(() => setPhase("idle"), 300);
        }, 2800);
        timersRef.current.push(t);
      }
    } else {
      try {
        const result = await onRefresh();
        if (typeof result === "string" && result) setImpactText(result);
        setPhase("done");
        const t = setTimeout(() => setPhase("idle"), 2400);
        timersRef.current.push(t);
      } catch {
        setPhase("error");
        const t = setTimeout(() => setPhase("idle"), 2000);
        timersRef.current.push(t);
      }
    }
  }

  const btnBase = cn(
    "inline-flex items-center gap-1.5 rounded-lg font-semibold text-white shadow-md transition-all hover:opacity-95 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm",
    style.btn,
    className
  );

  const doneText = impactText ?? "Updated!";

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={phase === "loading"}
        className={btnBase}
      >
        {phase === "done" ? (
          <>
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{doneText}</span>
          </>
        ) : phase === "error" ? (
          <>
            <XCircle className="size-4 shrink-0" />
            <span>Failed</span>
          </>
        ) : (
          <>
            <RefreshCw className={cn("size-4 shrink-0", phase === "loading" && "animate-spin")} />
            <span>{phase === "loading" ? "Refreshing…" : label}</span>
          </>
        )}
      </button>

      {stages && stages.length > 0 && (
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open && phase !== "loading") {
              setDialogOpen(false);
              setPhase("idle");
            }
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-base">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    phase === "loading" ? style.pulse : phase === "done" ? "bg-emerald-400" : "bg-destructive"
                  )}
                />
                {phase === "done"
                  ? impactText ?? "Data refreshed"
                  : phase === "error"
                  ? "Refresh failed"
                  : "Refreshing data…"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-1">
              {stageItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex size-6 shrink-0 items-center justify-center">
                    {item.state === "done" ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : item.state === "active" ? (
                      <RefreshCw className="size-4 animate-spin text-primary" />
                    ) : item.state === "error" ? (
                      <XCircle className="size-5 text-destructive" />
                    ) : (
                      <div className="size-2 rounded-full bg-border" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      item.state === "active" && "font-medium text-foreground",
                      item.state === "done" && "text-foreground",
                      item.state === "error" && "text-destructive",
                      item.state === "pending" && "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
