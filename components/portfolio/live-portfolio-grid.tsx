"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ChangeBadge } from "@/components/change-badge";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { computeSummary } from "@/lib/services/metrics";
import { formatPKR, plColorClass } from "@/lib/format";
import type { HoldingWithMetrics, Portfolio } from "@/lib/types";

export function LivePortfolioGrid({
  portfolios,
  holdings,
}: {
  portfolios: Portfolio[];
  holdings: HoldingWithMetrics[];
}) {
  const { liveHoldings } = useLiveHoldings(holdings);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {portfolios.map((p) => {
        const pf = liveHoldings.filter((h) => h.portfolio_id === p.id);
        const summary = computeSummary(pf);

        return (
          <Link key={p.id} href={`/portfolios/${p.id}`}>
            <Card className="group h-full gap-0 p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wallet className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {summary.holdingsCount} position{summary.holdingsCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="truncate text-xl font-semibold tabular-nums">
                    {formatPKR(summary.totalValue)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-medium tabular-nums ${plColorClass(summary.totalPL)}`}>
                    {formatPKR(summary.totalPL, { sign: true })}
                  </p>
                  <ChangeBadge pct={summary.totalPLPct} className="justify-end text-xs" />
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
