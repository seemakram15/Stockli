import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Secondary line under the value (e.g. a ChangeBadge). */
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  /** Tints the value text by P/L direction. */
  tone?: "default" | "gain" | "loss";
  className?: string;
}

export function StatCard({ label, value, sub, icon, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("min-w-0 gap-0 p-3 sm:p-5", className)}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p
        className={cn(
          "mt-2 text-lg font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] sm:text-2xl",
          tone === "gain" && "text-gain",
          tone === "loss" && "text-loss"
        )}
      >
        {value}
      </p>
      {sub && <div className="mt-1.5 text-sm">{sub}</div>}
    </Card>
  );
}
