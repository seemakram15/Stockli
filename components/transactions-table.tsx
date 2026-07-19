import Link from "next/link";
import type * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatPKR, formatNumber, formatDate } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";

const TYPE_STYLES: Record<TransactionType, string> = {
  BUY: "bg-gain/10 text-gain",
  SELL: "bg-loss/10 text-loss",
  ADD: "bg-muted text-muted-foreground",
  EDIT: "bg-muted text-muted-foreground",
  REMOVE: "bg-muted text-muted-foreground",
};

export function TransactionsTable({
  transactions,
  showSymbol = true,
  showBuyPL = false,
  currentPriceBySymbol,
}: {
  transactions: Transaction[];
  showSymbol?: boolean;
  showBuyPL?: boolean;
  currentPriceBySymbol?: Record<string, number | null>;
}) {
  if (transactions.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
        No transactions recorded yet.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2 p-3 sm:hidden">
        {transactions.map((t) => (
          <div key={t.id} className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", TYPE_STYLES[t.type])}>
                  {t.type}
                </span>
                {showSymbol && (
                  <Link
                    href={`/stock/${t.symbol}`}
                    className="truncate text-base font-black tracking-tight text-emerald-700 dark:text-emerald-500"
                  >
                    {t.symbol}
                  </Link>
                )}
              </div>
              <p className="shrink-0 text-xs text-muted-foreground">{formatDate(t.transacted_at)}</p>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-sm tabular-nums text-muted-foreground" style={{ wordBreak: "break-word" }}>
                {t.quantity && t.price
                  ? `${formatNumber(t.quantity, 0)} × ${formatNumber(t.price, 2)} = ${formatPKR(t.quantity * t.price)}`
                  : "—"}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {renderTrailingMetric(t, showBuyPL, currentPriceBySymbol)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto scrollbar-thin sm:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Type</TableHead>
            {showSymbol && <TableHead>Symbol</TableHead>}
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {showBuyPL ? "Total Buy P/L" : "Fees"}
            </TableHead>
            <TableHead className="text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    TYPE_STYLES[t.type]
                  )}
                >
                  {t.type}
                </span>
              </TableCell>
              {showSymbol && (
                <TableCell>
                  <Link href={`/stock/${t.symbol}`} className="font-medium hover:text-primary">
                    {t.symbol}
                  </Link>
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                {t.quantity ? formatNumber(t.quantity, 0) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {t.price ? formatPKR(t.price) : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {t.quantity && t.price ? formatPKR(t.quantity * t.price) : "—"}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {renderTrailingMetric(t, showBuyPL, currentPriceBySymbol)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatDate(t.transacted_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}

function renderTrailingMetric(
  transaction: Transaction,
  showBuyPL: boolean,
  currentPriceBySymbol?: Record<string, number | null>
) {
  if (!showBuyPL) {
    return <span className="text-muted-foreground">{formatPKR(transaction.fees)}</span>;
  }

  const currentPrice = currentPriceBySymbol?.[transaction.symbol.toUpperCase()] ?? null;
  const pnl = computeBuyTransactionPL(transaction, currentPrice);

  if (pnl == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return <span className={cn("font-medium", pnl > 0 ? "text-gain" : pnl < 0 ? "text-loss" : "text-foreground")}>{formatPKR(pnl, { sign: true })}</span>;
}

function computeBuyTransactionPL(transaction: Transaction, currentPrice: number | null) {
  if (transaction.type !== "BUY") return null;
  if (
    currentPrice == null ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(transaction.price) ||
    !Number.isFinite(transaction.quantity)
  ) {
    return null;
  }

  const livePrice = Number(currentPrice);
  const quantity = Number(transaction.quantity ?? 0);
  const buyPrice = Number(transaction.price ?? 0);
  const fees = Number(transaction.fees ?? 0);
  return livePrice * quantity - (buyPrice * quantity + fees);
}

