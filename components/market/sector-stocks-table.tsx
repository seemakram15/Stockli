"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { ChangeBadge } from "@/components/change-badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompact, formatPKR } from "@/lib/format";
import type { SectorStockPerformance } from "@/lib/services/market";

export function SectorStocksTable({
  stocks,
}: {
  stocks: SectorStockPerformance[];
}) {
  const [query, setQuery] = React.useState("");
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...stocks]
      .filter(
        (stock) =>
          !q ||
          stock.symbol.toLowerCase().includes(q) ||
          (stock.listedIn ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
  }, [stocks, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stocks..."
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Showing {rows.length} of {stocks.length}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No stocks match your search.
        </div>
      ) : (
        <>
          <div className="space-y-3 sm:hidden">
            {rows.map((stock) => (
              <StockCard key={stock.symbol} stock={stock} />
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-border scrollbar-thin sm:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Last</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">LDCP</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                  <TableHead className="text-right">High</TableHead>
                  <TableHead className="text-right">Low</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead>Listed in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((stock) => (
                  <TableRow key={stock.symbol} className="group">
                    <TableCell>
                      <Link href={`/stock/${stock.symbol}`} className="font-semibold group-hover:text-primary">
                        {stock.symbol}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPKR(stock.price)}</TableCell>
                    <TableCell className="text-right">
                      <ChangeBadge value={stock.change} pct={stock.changePct} showValue className="justify-end" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPKR(stock.ldcp)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPKR(stock.open)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPKR(stock.high)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPKR(stock.low)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCompact(stock.volume)}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-muted-foreground">
                      {stock.listedIn ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function StockCard({ stock }: { stock: SectorStockPerformance }) {
  return (
    <Link
      href={`/stock/${stock.symbol}`}
      className="block rounded-xl border border-border bg-card p-3 hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{stock.symbol}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {stock.listedIn ?? "Listed stock"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium tabular-nums">{formatPKR(stock.price)}</p>
          <ChangeBadge value={stock.change} pct={stock.changePct} showValue className="justify-end text-xs" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <MobileMetric label="LDCP" value={formatPKR(stock.ldcp)} />
        <MobileMetric label="Open" value={formatPKR(stock.open)} align="right" />
        <MobileMetric label="High" value={formatPKR(stock.high)} />
        <MobileMetric label="Low" value={formatPKR(stock.low)} align="right" />
        <MobileMetric label="Volume" value={formatCompact(stock.volume)} />
      </div>
    </Link>
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
