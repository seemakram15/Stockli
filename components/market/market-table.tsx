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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChangeBadge } from "@/components/change-badge";
import { formatPKR, formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MarketRow {
  symbol: string;
  company: string | null;
  sector: string | null;
  price: number;
  change: number;
  changePct: number;
  volume: number | null;
}

type SortKey = "symbol" | "price" | "changePct" | "volume";

export function MarketTable({ rows }: { rows: MarketRow[] }) {
  const [query, setQuery] = React.useState("");
  const [sector, setSector] = React.useState("ALL");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "volume",
    dir: -1,
  });

  const sectors = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.sector).filter(Boolean))).sort() as string[],
    [rows]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows.filter((r) => {
      const matchQ =
        !q ||
        r.symbol.toLowerCase().includes(q) ||
        (r.company ?? "").toLowerCase().includes(q);
      const matchS = sector === "ALL" || r.sector === sector;
      return matchQ && matchS;
    });
    out = [...out].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
    return out;
  }, [rows, query, sector, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "symbol" ? 1 : -1 }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by symbol or company…"
            className="pl-9"
          />
        </div>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="All sectors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sectors</SelectItem>
            {sectors.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} listings
      </p>

      <div className="overflow-x-auto scrollbar-thin rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortHead label="Symbol" k="symbol" sort={sort} onSort={toggleSort} />
              <TableHead className="hidden md:table-cell">Sector</TableHead>
              <SortHead label="Last" k="price" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Change" k="changePct" sort={sort} onSort={toggleSort} align="right" />
              <SortHead label="Volume" k="volume" sort={sort} onSort={toggleSort} align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.symbol} className="group">
                <TableCell>
                  <Link href={`/stock/${r.symbol}`} className="flex flex-col">
                    <span className="font-semibold group-hover:text-primary">{r.symbol}</span>
                    <span className="max-w-44 truncate text-xs text-muted-foreground">
                      {r.company}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {r.sector}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatPKR(r.price)}</TableCell>
                <TableCell className="text-right">
                  <ChangeBadge pct={r.changePct} className="justify-end" />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCompact(r.volume)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function sortValue(r: MarketRow, key: SortKey): number | string {
  if (key === "symbol") return r.symbol;
  if (key === "price") return r.price;
  if (key === "changePct") return r.changePct;
  return r.volume ?? 0;
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
