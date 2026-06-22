"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPKR, formatPercent } from "@/lib/format";
import type { CalendarDay } from "@/lib/services/daily-pl";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Large daily gain/loss calendar. When the user holds the stock, each day is
 * tinted by that day's position P/L (PKR); otherwise by the stock's daily move.
 * Months are derived from the data, so a held stock only shows months from the
 * first purchase onward.
 */
export function PLCalendar({
  data,
  hasPosition,
}: {
  data: CalendarDay[];
  hasPosition: boolean;
}) {
  const byDate = React.useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of data) m.set(d.date, d);
    return m;
  }, [data]);

  const months = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of data) set.add(d.date.slice(0, 7));
    return Array.from(set).sort();
  }, [data]);

  const [idx, setIdx] = React.useState(Math.max(0, months.length - 1));
  React.useEffect(() => {
    setIdx(Math.max(0, months.length - 1));
  }, [months.length]);

  const current = months[Math.min(idx, months.length - 1)];

  if (!current) {
    return (
      <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
        {hasPosition
          ? "No closing prices since your purchase yet — check back after the next session."
          : "No daily data available."}
      </div>
    );
  }

  const [year, month] = current.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const monthDays = data.filter((d) => d.date.startsWith(current));
  const metric = (d: CalendarDay) => (hasPosition ? d.dayPL : d.changePct);
  const maxAbs = Math.max(
    hasPosition ? 1 : 0.5,
    ...monthDays.map((d) => Math.abs(metric(d)))
  );
  const monthTotal = monthDays.reduce((a, d) => a + d.dayPL, 0);
  const upDays = monthDays.filter((d) => metric(d) > 0).length;
  const downDays = monthDays.filter((d) => metric(d) < 0).length;

  const cells: (CalendarDay | null | { date: string; empty: true })[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(byDate.get(ds) ?? { date: ds, empty: true });
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
          <div key={w} className="pb-1 text-center text-xs font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => (
          <DayCell
            key={i}
            cell={cell}
            maxAbs={maxAbs}
            hasPosition={hasPosition}
          />
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
  maxAbs,
  hasPosition,
}: {
  cell: CalendarDay | null | { date: string; empty: true };
  maxAbs: number;
  hasPosition: boolean;
}) {
  if (!cell) return <div className="aspect-square" />;
  const day = Number(cell.date.slice(8, 10));
  const hasData = !("empty" in cell);

  if (!hasData) {
    return (
      <div className="flex aspect-square flex-col rounded-lg border border-border/60 bg-muted/20 p-1.5 sm:p-2">
        <span className="text-xs font-medium text-muted-foreground/50">{day}</span>
      </div>
    );
  }

  const d = cell as CalendarDay;
  const value = hasPosition ? d.dayPL : d.changePct;
  const up = value > 0;
  const down = value < 0;
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const pctText = hasPosition ? formatPercent(d.dayPLPct) : formatPercent(d.changePct);

  return (
    <div
      className="group relative flex aspect-square flex-col rounded-lg border border-transparent p-1.5 transition-colors sm:p-2"
      style={tint(up ? "gain" : down ? "loss" : "muted", 0.18 + intensity * 0.62)}
      title={`${d.date}: ${pctText}${hasPosition ? ` · ${formatPKR(d.dayPL, { sign: true })}` : ""}`}
    >
      <span className="text-xs font-medium text-muted-foreground">{day}</span>
      <span className="mt-auto flex flex-col leading-tight">
        {hasPosition ? (
          <>
            <span
              className={cn(
                "text-[11px] font-semibold tabular-nums sm:text-xs",
                up ? "text-gain" : down ? "text-loss" : "text-muted-foreground"
              )}
            >
              {formatPKR(d.dayPL, { sign: true }).replace("Rs ", "")}
            </span>
            <span className="hidden text-[10px] tabular-nums text-muted-foreground sm:block">
              {pctText}
            </span>
          </>
        ) : (
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums sm:text-xs",
              up ? "text-gain" : down ? "text-loss" : "text-muted-foreground"
            )}
          >
            {formatPercent(d.changePct)}
          </span>
        )}
      </span>
    </div>
  );
}

function tint(kind: "gain" | "loss" | "muted", amount: number): React.CSSProperties {
  if (kind === "muted") return { backgroundColor: "transparent" };
  const pct = Math.round(amount * 100);
  return { backgroundColor: `color-mix(in oklab, var(--${kind}) ${pct}%, transparent)` };
}
