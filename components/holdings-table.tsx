"use client";

import * as React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChangeBadge } from "@/components/change-badge";
import { HoldingRowActions } from "@/components/portfolio/holding-row-actions";
import { useLiveHoldings } from "@/lib/hooks/use-live-holdings";
import { formatPKR, formatNumber, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HoldingWithMetrics } from "@/lib/types";

export function HoldingsTable({
  holdings,
  showPortfolio = false,
  portfolioNames,
  rowActions,
}: {
  holdings: HoldingWithMetrics[];
  showPortfolio?: boolean;
  portfolioNames?: Record<string, string>;
  /** When set, renders per-row trade/remove actions. */
  rowActions?: { demo?: boolean };
}) {
  const { liveHoldings: rows } = useLiveHoldings(holdings);

  return (
    <>
      <div className="space-y-3 p-3 sm:hidden">
        {rows.map((h) => (
          <div key={h.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <Link href={`/stock/${h.symbol}`} className="min-w-0">
                <span className="font-semibold">{h.symbol}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {h.ticker?.company_name ?? h.ticker?.sector ?? ""}
                </span>
                {showPortfolio && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {portfolioNames?.[h.portfolio_id] ?? "Portfolio"}
                  </span>
                )}
              </Link>
              {rowActions && (
                <HoldingRowActions
                  portfolioId={h.portfolio_id}
                  holdingId={h.id}
                  symbol={h.symbol}
                  demo={rowActions.demo}
                />
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <MobileMetric label="Qty" value={formatNumber(h.quantity, 0)} />
              <MobileMetric label="Last" value={formatPKR(h.livePrice)} align="right" />
              <MobileMetric label="Market value" value={formatPKR(h.marketValue)} />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Unreal. P/L</p>
                <p className={cn("font-semibold tabular-nums", plColorClass(h.unrealizedPL))}>
                  {formatPKR(h.unrealizedPL, { sign: true })}
                </p>
                <ChangeBadge pct={h.unrealizedPLPct} className="justify-end text-xs" />
              </div>
              <MobileMetric label="Avg cost" value={formatPKR(h.avg_buy_price)} />
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Day</p>
                <ChangeBadge pct={h.dayChangePct} className="justify-end" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto scrollbar-thin sm:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Symbol</TableHead>
            {showPortfolio && <TableHead className="hidden md:table-cell">Portfolio</TableHead>}
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Avg Cost</TableHead>
            <TableHead className="text-right">Last</TableHead>
            <TableHead className="text-right">Day</TableHead>
            <TableHead className="text-right">Mkt Value</TableHead>
            <TableHead className="text-right">Unreal. P/L</TableHead>
            {rowActions && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((h) => (
            <TableRow key={h.id} className="group">
              <TableCell>
                <Link href={`/stock/${h.symbol}`} className="flex flex-col">
                  <span className="font-semibold group-hover:text-primary">{h.symbol}</span>
                  <span className="max-w-40 truncate text-xs text-muted-foreground">
                    {h.ticker?.company_name ?? h.ticker?.sector ?? ""}
                  </span>
                </Link>
              </TableCell>
              {showPortfolio && (
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {portfolioNames?.[h.portfolio_id] ?? "—"}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                {formatNumber(h.quantity, 0)}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                {formatPKR(h.avg_buy_price)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPKR(h.livePrice)}
              </TableCell>
              <TableCell className="text-right">
                <ChangeBadge pct={h.dayChangePct} className="justify-end" />
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatPKR(h.marketValue)}
              </TableCell>
              <TableCell className="text-right">
                <div className={cn("font-medium tabular-nums", plColorClass(h.unrealizedPL))}>
                  {formatPKR(h.unrealizedPL, { sign: true })}
                </div>
                <ChangeBadge pct={h.unrealizedPLPct} className="justify-end text-xs" />
              </TableCell>
              {rowActions && (
                <TableCell className="text-right">
                  <HoldingRowActions
                    portfolioId={h.portfolio_id}
                    holdingId={h.id}
                    symbol={h.symbol}
                    demo={rowActions.demo}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}

function MobileMetric({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}
