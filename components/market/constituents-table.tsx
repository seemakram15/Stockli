"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ChangeBadge } from "@/components/change-badge";
import { formatPKR, formatCompact, formatNumber, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { IndexConstituent } from "@/lib/types";

type SortKey = "symbol" | "current" | "changePct" | "weight" | "volume";

export function ConstituentsTable({
  constituents,
}: {
  constituents: IndexConstituent[];
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "weight",
    dir: -1,
  });

  const maxWeight = React.useMemo(
    () => Math.max(1, ...constituents.map((c) => c.weight)),
    [constituents]
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = constituents.filter(
      (c) =>
        !q ||
        c.symbol.toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q)
    );
    return [...filtered].sort((a, b) => {
      const av = a[sort.key] ?? 0;
      const bv = b[sort.key] ?? 0;
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [constituents, query, sort]);

  function toggle(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "symbol" ? 1 : -1 }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter constituents…"
            className="pl-9"
          />
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {rows.length} of {constituents.length}
        </span>
      </div>

      <div className="space-y-3 sm:hidden">
        {rows.map((c) => (
          <Link
            key={c.symbol}
            href={`/stock/${c.symbol}`}
            className="block rounded-xl border border-border bg-card px-4 py-4 hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold">{c.symbol}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.name}</p>
              </div>
              <p className="shrink-0 whitespace-nowrap tabular-nums text-base font-medium">{formatPKR(c.current)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="tabular-nums text-sm font-medium">{formatNumber(c.weight, 2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volume</p>
                  <p className="tabular-nums text-sm font-medium">{formatCompact(c.volume)}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className={cn("tabular-nums text-sm", plColorClass(c.change))}>
                  {formatPKR(c.change, { sign: true })}
                </span>
                <ChangeBadge pct={c.changePct} className="text-xs" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="hidden overflow-x-auto scrollbar-thin rounded-lg border border-border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHead label="Symbol" k="symbol" sort={sort} onSort={toggle} />
              <SortHead label="Current" k="current" sort={sort} onSort={toggle} align="right" />
              <SortHead label="Change" k="changePct" sort={sort} onSort={toggle} align="right" />
              <SortHead label="Weight" k="weight" sort={sort} onSort={toggle} align="right" />
              <SortHead label="Volume" k="volume" sort={sort} onSort={toggle} align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.symbol} className="group">
                <TableCell>
                  <Link href={`/stock/${c.symbol}`} className="flex flex-col">
                    <span className="font-semibold group-hover:text-primary">{c.symbol}</span>
                    <span className="max-w-52 truncate text-xs text-muted-foreground">
                      {c.name}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPKR(c.current)}</TableCell>
                <TableCell className="text-right">
                  <PriceChange change={c.change} pct={c.changePct} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="tabular-nums">{formatNumber(c.weight, 2)}%</span>
                    <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:block">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (c.weight / maxWeight) * 100)}%` }}
                      />
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCompact(c.volume)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PriceChange({ change, pct }: { change: number; pct: number }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={cn("font-semibold tabular-nums", plColorClass(change))}>
        {formatPKR(change, { sign: true })}
      </span>
      <ChangeBadge pct={pct} className="justify-end text-xs" />
    </div>
  );
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
