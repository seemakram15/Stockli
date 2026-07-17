"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPKR, formatPercent } from "@/lib/format";
import { usePrices } from "@/lib/hooks/use-prices";
import { PSX_TIMEZONE } from "@/lib/constants";
import { hasPsxTradingStartedToday, isMarketOpen } from "@/lib/psx/market-hours";
import { computeDayChange, effectiveQuotePrice } from "@/lib/services/metrics";
import type { Quote } from "@/lib/types";
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
  livePositions = [],
  showSummaryPL = true,
}: {
  data: CalendarDay[];
  hasPosition: boolean;
  livePositions?: {
    symbol: string;
    quantity: number;
    avgBuyPrice: number;
    initial?: Quote | null;
    /** Precomputed today figures from a sibling live-holdings calculation
     *  (e.g. the page's own stat cards) — when every active position has
     *  these, they're used verbatim instead of an independent quote fetch,
     *  so this calendar can never disagree with that sibling view. */
    liveDayChange?: number;
    liveMarketValue?: number;
  }[];
  showSummaryPL?: boolean;
}) {
  const { liveData, positionSummary } = useLiveCalendarData(data, livePositions, hasPosition);
  const byDate = React.useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of liveData) m.set(d.date, d);
    return m;
  }, [liveData]);

  const months = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of liveData) set.add(d.date.slice(0, 7));
    return Array.from(set).sort();
  }, [liveData]);

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

  const monthDays = liveData.filter((d) => d.date.startsWith(current));
  const metric = (d: CalendarDay) => (hasPosition ? d.dayPL : d.changePct);
  const maxAbs = Math.max(
    hasPosition ? 1 : 0.5,
    ...monthDays.map((d) => Math.abs(metric(d)))
  );
  const monthTotal = monthDays.reduce((a, d) => a + d.dayPL, 0);
  const upDays = monthDays.filter((d) => metric(d) > 0).length;
  const downDays = monthDays.filter((d) => metric(d) < 0).length;
  const positionCounts =
    positionSummary &&
    positionSummary.totalPositions > 1 &&
    current === positionSummary.month
      ? positionSummary
      : null;

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
            {positionCounts ? (
              <>
                <span className="text-gain">{positionCounts.up}</span> holdings up ·{" "}
                <span className="text-loss">{positionCounts.down}</span> down today
              </>
            ) : (
              <>
                <span className="text-gain">{upDays}</span> gain days ·{" "}
                <span className="text-loss">{downDays}</span> loss days
              </>
            )}
          </span>
          {hasPosition && showSummaryPL && (
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

      <div className="pb-1">
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
              <span className="sm:hidden">{w.slice(0, 1)}</span>
              <span className="hidden sm:inline">{w}</span>
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

function useLiveCalendarData(
  data: CalendarDay[],
  livePositions: {
    symbol: string;
    quantity: number;
    avgBuyPrice: number;
    initial?: Quote | null;
    liveDayChange?: number;
    liveMarketValue?: number;
  }[],
  hasPosition: boolean
) {
  const active = React.useMemo(
    () => livePositions.filter((p) => p.quantity > 0),
    [livePositions]
  );
  const hasPrecomputed =
    active.length > 0 && active.every((p) => p.liveDayChange != null && p.liveMarketValue != null);
  const symbols = React.useMemo(
    () => (hasPrecomputed ? [] : active.map((p) => p.symbol)),
    [active, hasPrecomputed]
  );
  const initial = React.useMemo(
    () => active.map((p) => p.initial).filter(Boolean) as Quote[],
    [active]
  );
  const { quotes } = usePrices(symbols, initial);
  const [now, setNow] = React.useState(() => new Date());
  const tradingStartedToday = hasPsxTradingStartedToday(now);
  const marketOpen = isMarketOpen(now);

  React.useEffect(() => {
    if (!hasPosition || active.length === 0) return undefined;
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [active.length, hasPosition]);

  return React.useMemo(() => {
    const empty = { liveData: data, positionSummary: null };
    if (!hasPosition || active.length === 0) return empty;
    if (!tradingStartedToday) return empty;

    let dayPL = 0;
    let close = 0;
    let found = 0;
    let up = 0;
    let down = 0;
    for (const position of active) {
      if (position.liveDayChange != null && position.liveMarketValue != null) {
        found++;
        dayPL += position.liveDayChange;
        close += position.liveMarketValue;
        if (position.liveDayChange > 0) up++;
        if (position.liveDayChange < 0) down++;
        continue;
      }
      const q = (marketOpen ? quotes.get(position.symbol.toUpperCase()) : null) ?? position.initial;
      if (!q) continue;
      const price = effectiveQuotePrice(q);
      if (price == null) continue;
      found++;
      const { dayChange: positionPL } = computeDayChange(q, position.avgBuyPrice, position.quantity);
      dayPL += positionPL;
      close += price * position.quantity;
      if (positionPL > 0) up++;
      if (positionPL < 0) down++;
    }
    if (found === 0) return empty;

    const prevValue = close - dayPL;
    const dayPLPct = prevValue ? (dayPL / prevValue) * 100 : 0;
    const today = todayInPkt();
    const liveDay: CalendarDay = {
      date: today,
      close,
      changePct: dayPLPct,
      dayPL,
      dayPLPct,
      marketValue: close,
    };

    const next = data.filter((d) => d.date !== today);
    next.push(liveDay);
    return {
      liveData: next.sort((a, b) => a.date.localeCompare(b.date)),
      positionSummary: {
        month: today.slice(0, 7),
        up,
        down,
        totalPositions: found,
      },
    };
  }, [active, data, hasPosition, quotes, tradingStartedToday, marketOpen]);
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
      <div className="flex aspect-square flex-col rounded-lg border border-border/40 bg-muted/10 p-1.5 sm:p-2">
        <span className="text-[10px] font-medium text-muted-foreground/40 sm:text-xs">{day}</span>
      </div>
    );
  }

  const d = cell as CalendarDay;
  const value = hasPosition ? d.dayPL : d.changePct;
  const up = value > 0;
  const down = value < 0;
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const pctText = hasPosition ? formatPercent(d.dayPLPct) : formatPercent(d.changePct);
  const fullValueText = formatPKR(d.dayPL, { sign: true });
  const compactValue = compactPKR(d.dayPL);
  const active = up || down;

  return (
    <div
      className={cn(
        "group relative flex aspect-square flex-col rounded-lg border p-1.5 transition-colors sm:p-2",
        up ? "border-gain/40" : down ? "border-loss/40" : "border-border/30"
      )}
      style={tint(up ? "gain" : down ? "loss" : "muted", 0.22 + intensity * 0.55)}
      title={`${d.date}: ${hasPosition ? fullValueText : pctText}`}
    >
      {/* Day number */}
      <span className={cn(
        "text-[10px] font-semibold leading-none sm:text-xs",
        active ? "text-foreground/70" : "text-muted-foreground/50"
      )}>
        {day}
      </span>

      {/* Values centred in remaining space */}
      <div className="flex flex-1 flex-col items-center justify-center gap-[3px]">
        {hasPosition ? (
          <>
            <span className={cn(
              "rounded px-1 py-0.5 text-center text-[9px] font-bold tabular-nums leading-none sm:hidden",
              active
                ? "bg-background/85 text-foreground shadow-sm ring-1 ring-foreground/10"
                : "text-muted-foreground/60"
            )}>
              {compactValue}
            </span>
            <span className={cn(
              "hidden whitespace-nowrap rounded px-1 py-0.5 text-center text-[11px] font-bold tabular-nums leading-none sm:block",
              active
                ? "bg-background/85 text-foreground shadow-sm ring-1 ring-foreground/10"
                : "text-muted-foreground/60"
            )}>
              {fullValueText}
            </span>
            <span className={cn(
              "text-center text-[8px] font-semibold tabular-nums leading-none sm:text-[10px]",
              up ? "text-gain/80" : down ? "text-loss/80" : "text-muted-foreground/50"
            )}>
              {pctText}
            </span>
          </>
        ) : (
          <span className={cn(
            "rounded px-1 py-0.5 text-center text-[10px] font-semibold tabular-nums leading-none sm:text-xs",
            active
              ? "bg-background/85 text-foreground shadow-sm ring-1 ring-foreground/10"
              : "text-muted-foreground/50"
          )}>
            {formatPercent(d.changePct)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Compact PKR: keeps values short enough for narrow mobile cells. */
function compactPKR(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "−" : "+";
  const abs = Math.abs(value);
  if (abs >= 1_000) return `${sign}${(abs / 1000).toFixed(2)}k`;
  return `${sign}${abs.toFixed(2)}`;
}

function tint(kind: "gain" | "loss" | "muted", amount: number): React.CSSProperties {
  if (kind === "muted") return { backgroundColor: "transparent" };
  const pct = Math.round(amount * 100);
  return { backgroundColor: `color-mix(in oklab, var(--${kind}) ${pct}%, transparent)` };
}

function todayInPkt(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PSX_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
