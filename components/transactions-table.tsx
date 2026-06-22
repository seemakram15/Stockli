import Link from "next/link";
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
}: {
  transactions: Transaction[];
  showSymbol?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-sm text-muted-foreground">
        No transactions recorded yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Type</TableHead>
            {showSymbol && <TableHead>Symbol</TableHead>}
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Fees</TableHead>
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
              <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                {formatPKR(t.fees)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatDate(t.transacted_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
