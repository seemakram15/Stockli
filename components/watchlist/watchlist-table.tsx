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
import { effectiveQuotePrice } from "@/lib/services/metrics";
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
    <>
      <div className="space-y-3 p-3 sm:hidden">
        {items.map((it) => {
          const q = quotes.get(it.symbol.toUpperCase());
          const price = effectiveQuotePrice(q ?? null);
          return (
            <div key={it.symbol} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/stock/${it.symbol}`} className="min-w-0">
                  <span className="font-semibold">{it.symbol}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {it.company ?? it.sector ?? ""}
                  </span>
                </Link>
                <RemoveWatchItem symbol={it.symbol} demo={demo} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <MobileMetric label="Last" value={formatPKR(price)} />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Change</p>
                  <ChangeBadge pct={q?.changePct} className="justify-end" />
                </div>
                <MobileMetric label="Sector" value={it.sector ?? "—"} />
                <MobileMetric label="Volume" value={formatCompact(q?.volume ?? null)} align="right" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto scrollbar-thin sm:block">
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
              const price = effectiveQuotePrice(q ?? null);
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
                    {formatPKR(price)}
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
