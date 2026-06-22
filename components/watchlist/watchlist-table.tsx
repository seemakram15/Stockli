"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChangeBadge } from "@/components/change-badge";
import { usePrices } from "@/lib/hooks/use-prices";
import { formatPKR, formatCompact } from "@/lib/format";
import { removeFromWatchlist } from "@/lib/actions/watchlist";
import type { Quote } from "@/lib/types";

export interface WatchItem {
  symbol: string;
  company: string | null;
  sector: string | null;
}

export function WatchlistTable({
  items,
  initial,
  demo,
}: {
  items: WatchItem[];
  initial?: Quote[];
  demo?: boolean;
}) {
  const symbols = React.useMemo(() => items.map((i) => i.symbol), [items]);
  const { quotes } = usePrices(symbols, initial);

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Symbol</TableHead>
            <TableHead className="hidden md:table-cell">Sector</TableHead>
            <TableHead className="text-right">Last</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Volume</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => {
            const q = quotes.get(it.symbol.toUpperCase());
            return (
              <TableRow key={it.symbol} className="group">
                <TableCell>
                  <Link href={`/stock/${it.symbol}`} className="flex flex-col">
                    <span className="font-semibold group-hover:text-primary">{it.symbol}</span>
                    <span className="max-w-44 truncate text-xs text-muted-foreground">
                      {it.company}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {it.sector}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPKR(q?.price ?? null)}
                </TableCell>
                <TableCell className="text-right">
                  <ChangeBadge pct={q?.changePct} className="justify-end" />
                </TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                  {formatCompact(q?.volume ?? null)}
                </TableCell>
                <TableCell className="text-right">
                  <RemoveWatchItem symbol={it.symbol} demo={demo} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function RemoveWatchItem({ symbol, demo }: { symbol: string; demo?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Remove">
          <X className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {symbol} from watchlist?</AlertDialogTitle>
          <AlertDialogDescription>
            This only removes it from your watchlist. It does not affect any holdings or alerts.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {demo ? (
            <AlertDialogAction onClick={() => toast.error("Demo mode — add Supabase keys to edit watchlists.")}>
              Remove
            </AlertDialogAction>
          ) : (
            <form
              action={async (formData) => {
                await removeFromWatchlist(formData);
                toast.success(`${symbol} removed from watchlist.`);
              }}
            >
              <input type="hidden" name="symbol" value={symbol} />
              <AlertDialogAction type="submit">Remove</AlertDialogAction>
            </form>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
