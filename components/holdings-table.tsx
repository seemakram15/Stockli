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
import { usePrices } from "@/lib/hooks/use-prices";
import { computeHoldingMetrics } from "@/lib/services/metrics";
import { formatPKR, formatNumber, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HoldingWithMetrics, Quote } from "@/lib/types";

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
  const symbols = React.useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const initial = React.useMemo(
    () => holdings.map((h) => h.quote).filter(Boolean) as Quote[],
    [holdings]
  );
  const { quotes } = usePrices(symbols, initial);

  // Recompute metrics from the freshest quote (falls back to server value).
  const rows = React.useMemo(
    () =>
      holdings
        .map((h) => {
          const live = quotes.get(h.symbol.toUpperCase()) ?? h.quote;
          return computeHoldingMetrics(h, h.ticker, live);
        })
        .sort((a, b) => b.marketValue - a.marketValue),
    [holdings, quotes]
  );

  return (
    <div className="overflow-x-auto scrollbar-thin">
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
                {formatPKR(h.quote?.price ?? h.avg_buy_price)}
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
  );
}
