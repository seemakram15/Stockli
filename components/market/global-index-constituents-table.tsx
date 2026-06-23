"use client";

import * as React from "react";
import { ArrowDownUp, ExternalLink, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  GlobalIndexConstituent,
  GlobalIndexConstituentsData,
} from "@/lib/services/global-index-constituents";

type SortKey = "symbol" | "name" | "sector" | "industry" | "exchange";

export function GlobalIndexConstituentsTable({
  data,
}: {
  data: GlobalIndexConstituentsData;
}) {
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.constituents
      .filter((row) => {
        if (!q) return true;
        return [
          row.symbol,
          row.name,
          row.sector,
          row.industry,
          row.exchange,
          row.country,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      })
      .sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [data.constituents, query, sortDir, sortKey]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{data.constituents.length.toLocaleString("en-US")} stocks</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.sourceLabel}
            </p>
          </div>
          <a
            href={data.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-4" />
            Source
          </a>
        </div>

        <label className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search symbol, stock, sector..."
            className="pl-9"
          />
        </label>
      </CardHeader>

      <CardContent className="px-3 pb-4 sm:px-2">
        {data.note ? (
          <div className="mx-4 mb-4 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {data.note}
          </div>
        ) : null}

        <div className="space-y-3 sm:hidden">
          {rows.map((row) => (
            <ConstituentMobileCard key={`${row.symbol}-${row.name}-mobile`} row={row} />
          ))}
          {rows.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              No constituents match the current search.
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto scrollbar-thin sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="Symbol" active={sortKey === "symbol"} onClick={() => toggleSort("symbol")} />
                <SortableHead label="Stock" active={sortKey === "name"} onClick={() => toggleSort("name")} />
                <SortableHead label="Sector" active={sortKey === "sector"} onClick={() => toggleSort("sector")} />
                <SortableHead label="Industry" active={sortKey === "industry"} onClick={() => toggleSort("industry")} />
                <SortableHead label="Exchange" active={sortKey === "exchange"} onClick={() => toggleSort("exchange")} />
                <TableHead>Country</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.symbol}-${row.name}`}>
                  <TableCell className="font-semibold tabular-nums">{row.symbol}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.sector ?? "—"}</TableCell>
                  <TableCell>{row.industry ?? "—"}</TableCell>
                  <TableCell>{row.exchange ?? "—"}</TableCell>
                  <TableCell>{row.country ?? "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                    No constituents match the current search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ConstituentMobileCard({ row }: { row: GlobalIndexConstituent }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold tabular-nums">{row.symbol}</p>
          <p className="mt-0.5 truncate text-sm font-medium">{row.name}</p>
        </div>
        <p className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {row.country ?? "—"}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <MobileMetric label="Sector" value={row.sector ?? "—"} />
        <MobileMetric label="Exchange" value={row.exchange ?? "—"} align="right" />
        <MobileMetric label="Industry" value={row.industry ?? "—"} />
      </div>
    </div>
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
      <p className="font-medium">{value}</p>
    </div>
  );
}

function SortableHead({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <TableHead>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-foreground"
      >
        {label}
        <ArrowDownUp className={cn("size-3", active ? "text-primary" : "text-muted-foreground")} />
      </button>
    </TableHead>
  );
}

function compareRows(
  a: GlobalIndexConstituent,
  b: GlobalIndexConstituent,
  key: SortKey,
  dir: "asc" | "desc"
) {
  const factor = dir === "asc" ? 1 : -1;
  const av = valueFor(a, key);
  const bv = valueFor(b, key);
  return av.localeCompare(bv) * factor;
}

function valueFor(row: GlobalIndexConstituent, key: SortKey) {
  if (key === "symbol") return row.symbol;
  if (key === "name") return row.name;
  if (key === "sector") return row.sector ?? "";
  if (key === "industry") return row.industry ?? "";
  return row.exchange ?? "";
}
