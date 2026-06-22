"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPKR, formatPercent } from "@/lib/format";
import type { DayPL } from "@/lib/services/daily-pl";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * The large daily gain/loss calendar. Each day cell is tinted green/red by
 * that day's P/L for the position; intensity scales with the day's % move.
 * `perShare` toggles between position P/L and per-share change.
 */
export function PLCalendar({
  data,
  hasPosition,
}: {
  data: DayPL[];
  hasPosition: boolean;
}) {
  const byDate = React.useMemo(() => {
    const m = new Map<string, DayPL>();
    for (const d of data) m.set(d.date, d);
    return m;
  }, [data]);

  const months = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of data) set.add(d.date.slice(0, 7)); // YYYY-MM
    return Array.from(set).sort();
  }, [data]);

  const [idx, setIdx] = React.useState(Math.max(0, months.length - 1));
  const current = months[idx] ?? months[months.length - 1];

  if (!current) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No daily data available
      </div>
    );
  }

  const [year, month] = current.split("-").map(Number); // month: 1-12
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Max absolute % move in this month → intensity scaling.
  const monthDays = data.filter((d) => d.date.startsWith(current));
  const maxAbsPct = Math.max(0.5, ...monthDays.map((d) => Math.abs(d.changePct)));
  const monthTotal = monthDays.reduce((a, d) => a + d.dayPL, 0);
  const upDays = monthDays.filter((d) => d.dayPL > 0).length;
  const downDays = monthDays.filter((d) => d.dayPL < 0).length;

  const cells: (DayPL | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(byDate.get(ds) ?? ({ date: ds } as DayPL));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={idx <= 0}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-base font-semibold">
            {MONTHS[month - 1]} {year}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={idx >= months.length - 1}
            onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <span className="text-gain">{upDays}</span> up ·{" "}
            <span className="text-loss">{downDays}</span> down
          </span>
          {hasPosition && (
            <span
              className={cn(
                "font-semibold tabular-nums",
                monthTotal > 0 ? "text-gain" : monthTotal < 0 ? "text-loss" : ""
              )}
            >
              {formatPKR(monthTotal, { sign: true })}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map((cell, i) => (
          <DayCell key={i} cell={cell} maxAbsPct={maxAbsPct} hasPosition={hasPosition} />
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Loss</span>
        <span className="size-3 rounded-sm" style={tint("loss", 1)} />
        <span className="size-3 rounded-sm" style={tint("loss", 0.5)} />
        <span className="size-3 rounded-sm border border-border bg-muted/40" />
        <span className="size-3 rounded-sm" style={tint("gain", 0.5)} />
        <span className="size-3 rounded-sm" style={tint("gain", 1)} />
        <span>Gain</span>
      </div>
    </div>
  );
}

function DayCell({
  cell,
  maxAbsPct,
  hasPosition,
}: {
  cell: (DayPL & { dayPL?: number }) | null;
  maxAbsPct: number;
  hasPosition: boolean;
}) {
  if (!cell) return <div className="aspect-square" />;
  const day = Number(cell.date.slice(8, 10));
  const hasData = cell.changePct !== undefined && !Number.isNaN(cell.changePct);
  const up = (cell.dayPL ?? cell.changePct ?? 0) > 0;
  const down = (cell.dayPL ?? cell.changePct ?? 0) < 0;
  const intensity = hasData ? Math.min(1, Math.abs(cell.changePct) / maxAbsPct) : 0;

  return (
    <div
      className={cn(
        "group relative flex aspect-square flex-col rounded-lg border p-1.5 transition-colors sm:p-2",
        hasData ? "border-transparent" : "border-border bg-muted/30"
      )}
      style={hasData ? tint(up ? "gain" : down ? "loss" : "muted", 0.18 + intensity * 0.6) : undefined}
      title={
        hasData
          ? `${cell.date}: ${formatPercent(cell.changePct)}${hasPosition ? ` · ${formatPKR(cell.dayPL, { sign: true })}` : ""}`
          : cell.date
      }
    >
      <span className="text-xs font-medium text-muted-foreground">{day}</span>
      {hasData && (
        <span className="mt-auto flex flex-col leading-tight">
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums sm:text-xs",
              up ? "text-gain" : down ? "text-loss" : "text-muted-foreground"
            )}
          >
            {formatPercent(cell.changePct)}
          </span>
          {hasPosition && (
            <span className="hidden text-[10px] tabular-nums text-muted-foreground sm:block">
              {formatPKR(cell.dayPL, { sign: true }).replace("Rs ", "")}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function tint(kind: "gain" | "loss" | "muted", amount: number): React.CSSProperties {
  if (kind === "muted") return { backgroundColor: "transparent" };
  const pct = Math.round(amount * 100);
  return {
    backgroundColor: `color-mix(in oklab, var(--${kind}) ${pct}%, transparent)`,
  };
}
