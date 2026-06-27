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
import { formatPKR, formatNumber, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HoldingWithMetrics } from "@/lib/types";

export function HoldingsTable({
  holdings,
  showPortfolio = false,
  portfolioNames,
  rowActions,
  compact = false,
  userId,
}: {
  holdings: HoldingWithMetrics[];
  showPortfolio?: boolean;
  portfolioNames?: Record<string, string>;
  /** When set, renders per-row trade/remove actions. */
  rowActions?: { demo?: boolean };
  /** Compact view for dashboard summaries. Portfolio pages keep the full detail table. */
  compact?: boolean;
  userId?: string | null;
}) {
  const { liveHoldings: rows } = useLiveHoldings(holdings);

  if (compact) {
    return (
      <>
        <div className="space-y-3 p-3 sm:hidden">
          {rows.map((h) => (
            <MobileHoldingCard
              key={h.id}
              holding={h}
              portfolioName={showPortfolio ? portfolioNames?.[h.portfolio_id] : undefined}
            />
          ))}
        </div>

        <div className="hidden overflow-x-auto scrollbar-thin sm:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Symbol</TableHead>
                {showPortfolio && <TableHead>Portfolio</TableHead>}
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Day P/L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.id} className="group">
                  <TableCell>
                    <Link href={`/stock/${h.symbol}`} className="flex flex-col">
                      <span className="font-semibold group-hover:text-primary">{h.symbol}</span>
                      <span className="max-w-64 truncate text-xs text-muted-foreground">
                        {h.ticker?.company_name ?? h.ticker?.sector ?? ""}
                      </span>
                    </Link>
                  </TableCell>
                  {showPortfolio && (
                    <TableCell className="text-muted-foreground">
                      {portfolioNames?.[h.portfolio_id] ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">
                    {formatPKR(h.livePrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DailyPLValue value={h.dayChange} pct={h.dayChangePct} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3 p-3 sm:hidden">
        {rows.map((h) => (
          <MobileHoldingCard
            key={h.id}
            holding={h}
            portfolioName={showPortfolio ? portfolioNames?.[h.portfolio_id] : undefined}
            actions={
              rowActions ? (
                <HoldingRowActions
                  portfolioId={h.portfolio_id}
                  holdingId={h.id}
                  symbol={h.symbol}
                  demo={rowActions.demo}
                  userId={userId}
                />
              ) : null
            }
          />
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
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Day P/L</TableHead>
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
                <DailyPLValue value={h.dayChange} pct={h.dayChangePct} />
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
                    userId={userId}
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

function DailyPLValue({ value, pct }: { value: number; pct: number }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={cn("font-semibold tabular-nums", plColorClass(value))}>
        {formatPKR(value, { sign: true })}
      </span>
      <ChangeBadge pct={pct} className="justify-end text-xs" />
    </div>
  );
}

function MobileHoldingCard({
  holding,
  portfolioName,
  actions,
}: {
  holding: HoldingWithMetrics;
  portfolioName?: string;
  actions?: React.ReactNode;
}) {
  const dayClass = plColorClass(holding.dayChange);
  const totalClass = plColorClass(holding.unrealizedPL);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="grid min-h-28 grid-cols-[4.6rem_minmax(0,1fr)_minmax(0,1.08fr)_minmax(0,1fr)] gap-2.5">
        <Link href={`/stock/${holding.symbol}`} className="min-w-0">
          <p className="truncate text-2xl font-bold tracking-tight text-primary">
            {holding.symbol}
          </p>
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Current
          </p>
          <p className="text-xl font-medium leading-tight tabular-nums text-foreground">
            {formatNumber(holding.livePrice, 2)}
          </p>
          {portfolioName ? (
            <p className="mt-2 truncate text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              {portfolioName}
            </p>
          ) : null}
        </Link>

        <div className="min-w-0 space-y-2">
          <MobilePositionMetric label="Total cost" value={formatPKR(holding.costBasis)} />
          <MobilePositionMetric label="Avg buy" value={formatNumber(holding.avg_buy_price, 2)} />
          <MobilePositionMetric label="Shares" value={formatNumber(holding.quantity, 0)} />
        </div>

        <div className="min-w-0 space-y-2">
          <MobilePositionMetric
            label="Market value"
            value={formatPKR(holding.marketValue)}
          />
          <MobilePositionMetric
            label="Day's P/L"
            value={
              <span>
                <span className="block">{formatPKR(holding.dayChange, { sign: true })}</span>
                <span className="block">
                  {formatPercent(holding.dayChangePct)}
                </span>
              </span>
            }
            valueClassName={dayClass}
          />
        </div>

        <div className="flex min-w-0 flex-col items-end gap-2">
          {actions ? (
            <div className="rounded-full bg-muted/80 [&_button]:size-8">
              {actions}
            </div>
          ) : (
            <div className="h-8" aria-hidden />
          )}
          <MobilePositionMetric
            label="Total P/L"
            value={
              <span>
                <span className="block">{formatPKR(holding.unrealizedPL, { sign: true })}</span>
                <span className="block">
                  {formatPercent(holding.unrealizedPLPct)}
                </span>
              </span>
            }
            valueClassName={totalClass}
            align="right"
          />
        </div>
      </div>
    </article>
  );
}

function MobilePositionMetric({
  label,
  value,
  align = "left",
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  align?: "left" | "right";
  valueClassName?: string;
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("break-words text-[clamp(0.78rem,3vw,0.95rem)] font-medium leading-tight tabular-nums text-foreground", valueClassName)}>
        {value}
      </p>
    </div>
  );
}
