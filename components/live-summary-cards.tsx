"use client";

import * as React from "react";
import { CalendarClock, Coins, TrendingUp, Wallet } from "lucide-react";
import { ChangeBadge } from "@/components/change-badge";
import { StatCard } from "@/components/stat-card";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { computeSummary } from "@/lib/services/metrics";
import { formatPKR } from "@/lib/format";
import type { HoldingWithMetrics } from "@/lib/types";

export function LiveSummaryCards({
  holdings,
  liveHoldings: precomputedLiveHoldings,
  realizedPL = 0,
  valueLabel = "Total Value",
  holdingsLabel = "positions",
  dayPLOverride,
}: {
  holdings: HoldingWithMetrics[];
  /** Pass this when a parent already computed live holdings (e.g. to also
   *  feed a sibling PLCalendar) — keeps both views byte-identical instead of
   *  each independently polling quotes. */
  liveHoldings?: HoldingWithMetrics[];
  realizedPL?: number;
  valueLabel?: string;
  holdingsLabel?: string;
  /** When there's no live session today, use the gain/loss calendar's own
   *  most recent day instead of a quote-derived figure — the calendar's
   *  persisted/EOD numbers are the authoritative record for a closed day,
   *  so this keeps the stat card from disagreeing with it. */
  dayPLOverride?: { dayPL: number; dayPLPct: number } | null;
}) {
  const { liveHoldings: ownLiveHoldings } = useLiveHoldings(
    precomputedLiveHoldings ? [] : holdings
  );
  const liveHoldings = precomputedLiveHoldings ?? ownLiveHoldings;
  const summary = React.useMemo(() => {
    const base = computeSummary(liveHoldings, realizedPL);
    if (!dayPLOverride) return base;
    return { ...base, dayPL: dayPLOverride.dayPL, dayPLPct: dayPLOverride.dayPLPct };
  }, [liveHoldings, realizedPL, dayPLOverride]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="Day's P/L"
        value={formatPKR(summary.dayPL, { sign: true })}
        tone={summary.dayPL > 0 ? "gain" : summary.dayPL < 0 ? "loss" : "default"}
        accent="sky"
        icon={<CalendarClock className="size-4" />}
        sub={<ChangeBadge pct={summary.dayPLPct} variant="pill" />}
      />
      <StatCard
        label="Total P/L"
        value={formatPKR(summary.totalPL, { sign: true })}
        tone={summary.totalPL > 0 ? "gain" : summary.totalPL < 0 ? "loss" : "default"}
        accent="violet"
        icon={<TrendingUp className="size-4" />}
        sub={<ChangeBadge pct={summary.totalPLPct} variant="pill" />}
      />
      <StatCard
        label={valueLabel}
        value={formatPKR(summary.totalValue)}
        accent="primary"
        icon={<Wallet className="size-4" />}
        sub={
          <span className="text-muted-foreground">
            {summary.holdingsCount} {holdingsLabel}
          </span>
        }
      />
      <StatCard
        label="Invested"
        value={formatPKR(summary.totalInvested)}
        accent="amber"
        icon={<Coins className="size-4" />}
        sub={
          <span className="text-muted-foreground">
            Realized {formatPKR(summary.realizedPL, { sign: true })}
          </span>
        }
      />
    </div>
  );
}
