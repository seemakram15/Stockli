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
  realizedPL = 0,
  valueLabel = "Total Value",
  holdingsLabel = "positions",
}: {
  holdings: HoldingWithMetrics[];
  realizedPL?: number;
  valueLabel?: string;
  holdingsLabel?: string;
}) {
  const { liveHoldings } = useLiveHoldings(holdings);
  const summary = React.useMemo(
    () => computeSummary(liveHoldings, realizedPL),
    [liveHoldings, realizedPL]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={valueLabel}
        value={formatPKR(summary.totalValue)}
        icon={<Wallet className="size-4" />}
        sub={
          <span className="text-muted-foreground">
            {summary.holdingsCount} {holdingsLabel}
          </span>
        }
      />
      <StatCard
        label="Total P/L"
        value={formatPKR(summary.totalPL, { sign: true })}
        tone={summary.totalPL > 0 ? "gain" : summary.totalPL < 0 ? "loss" : "default"}
        icon={<TrendingUp className="size-4" />}
        sub={<ChangeBadge pct={summary.totalPLPct} variant="pill" />}
      />
      <StatCard
        label="Day's P/L"
        value={formatPKR(summary.dayPL, { sign: true })}
        tone={summary.dayPL > 0 ? "gain" : summary.dayPL < 0 ? "loss" : "default"}
        icon={<CalendarClock className="size-4" />}
        sub={<ChangeBadge pct={summary.dayPLPct} variant="pill" />}
      />
      <StatCard
        label="Invested"
        value={formatPKR(summary.totalInvested)}
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
