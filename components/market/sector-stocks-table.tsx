"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { SectorStockPerformance } from "@/lib/services/market";

type SortKey = "symbol" | "price" | "changePct" | "open" | "high" | "low" | "volume";

export function SectorStocksTable({
  stocks,
}: {
  stocks: SectorStockPerformance[];
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "changePct",
    dir: -1,
  });
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...stocks]
      .filter(
        (stock) =>
          !q || stock.symbol.toLowerCase().includes(q)
      )
      .sort((a, b) => compareStocks(a, b, sort));
  }, [stocks, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: (current.dir * -1) as 1 | -1 }
        : { key, dir: key === "symbol" ? 1 : -1 }
    );
  }

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
                  <SortHead label="Symbol" k="symbol" sort={sort} onSort={toggleSort} />
                  <SortHead label="Current" k="price" sort={sort} onSort={toggleSort} align="right" />
                  <SortHead label="Change" k="changePct" sort={sort} onSort={toggleSort} align="right" />
                  <SortHead label="Open" k="open" sort={sort} onSort={toggleSort} align="right" />
                  <SortHead label="High" k="high" sort={sort} onSort={toggleSort} align="right" />
                  <SortHead label="Low" k="low" sort={sort} onSort={toggleSort} align="right" />
                  <SortHead label="Volume" k="volume" sort={sort} onSort={toggleSort} align="right" />
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
          <p className="mt-0.5 truncate text-xs text-muted-foreground">Sector stock</p>
        </div>
        <div className="text-right">
          <p className="font-medium tabular-nums">{formatPKR(stock.price)}</p>
          <ChangeBadge value={stock.change} pct={stock.changePct} showValue className="justify-end text-xs" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <MobileMetric label="Open" value={formatPKR(stock.open)} />
        <MobileMetric label="High" value={formatPKR(stock.high)} />
        <MobileMetric label="Low" value={formatPKR(stock.low)} align="right" />
        <MobileMetric label="Volume" value={formatCompact(stock.volume)} />
      </div>
    </Link>
  );
}

function compareStocks(
  a: SectorStockPerformance,
  b: SectorStockPerformance,
  sort: { key: SortKey; dir: 1 | -1 }
) {
  if (sort.key === "symbol") return a.symbol.localeCompare(b.symbol) * sort.dir;
  const av = a[sort.key] ?? Number.NEGATIVE_INFINITY;
  const bv = b[sort.key] ?? Number.NEGATIVE_INFINITY;
  if (av < bv) return -1 * sort.dir;
  if (av > bv) return 1 * sort.dir;
  return a.symbol.localeCompare(b.symbol);
}

function SortHead({
  label,
  k,
  sort,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          align === "right" && "flex-row-reverse",
          sort.key === k && "text-foreground"
        )}
      >
        {label}
        <ArrowUpDown className="size-3" />
      </button>
    </TableHead>
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
