"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatPercent, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import type { MufapFund, MufapFundsData } from "@/lib/services/mufap";

type SortKey = "name" | "nav" | "d1" | "mtd" | "ytd" | "d365";

export function EtfTable({ data }: { data: MufapFundsData }) {
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const sorted = React.useMemo(
    () => [...data.funds].sort((a, b) => sortFunds(a, b, sortKey, sortDir)),
    [data.funds, sortKey, sortDir]
  );

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <SortHead label="Fund" active={sortKey === "name"} onClick={() => toggle("name")} className="min-w-[280px]" />
              <SortHead label="NAV" active={sortKey === "nav"} onClick={() => toggle("nav")} align="right" className="w-28" />
              <SortHead label="1 Day" active={sortKey === "d1"} onClick={() => toggle("d1")} align="right" className="w-24" />
              <SortHead label="MTD" active={sortKey === "mtd"} onClick={() => toggle("mtd")} align="right" className="w-24" />
              <SortHead label="YTD" active={sortKey === "ytd"} onClick={() => toggle("ytd")} align="right" className="w-24" />
              <SortHead label="365 Days" active={sortKey === "d365"} onClick={() => toggle("d365")} align="right" className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((fund) => (
              <TableRow key={fund.fundId ?? fund.name} className="hover:bg-muted/20">
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <AmcBrandMark label={fund.amc} size="sm" logoUrl={fund.amcLogoUrl} />
                    <div className="min-w-0">
                      {fund.fundId ? (
                        <Link
                          href={`/market/etfs/${fund.fundId}`}
                          className="font-semibold hover:underline"
                        >
                          {fund.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{fund.name}</span>
                      )}
                      <p className="text-xs text-muted-foreground">{fund.amcShort || fund.amc}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fund.nav != null ? formatNumber(fund.nav, 4) : "—"}
                </TableCell>
                <ReturnCell value={fund.d1} />
                <ReturnCell value={fund.mtd} />
                <ReturnCell value={fund.ytd} />
                <ReturnCell value={fund.d365} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        {sorted.length} ETF{sorted.length !== 1 ? "s" : ""} · MUFAP data
      </div>
    </div>
  );
}

function ReturnCell({ value }: { value: number | null }) {
  return (
    <TableCell className={cn("text-right font-semibold tabular-nums", plColorClass(value))}>
      {value != null ? formatPercent(value) : "—"}
    </TableCell>
  );
}

function SortHead({
  label,
  active,
  onClick,
  align = "left",
  className,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-foreground",
          active && "text-foreground",
          align === "right" && "w-full justify-end"
        )}
      >
        {label}
        <ArrowDownUp
          className={cn(
            "size-3 transition-colors",
            active ? "text-primary" : "text-muted-foreground"
          )}
        />
      </button>
    </TableHead>
  );
}

function sortFunds(a: MufapFund, b: MufapFund, key: SortKey, dir: "asc" | "desc") {
  const f = dir === "asc" ? 1 : -1;
  if (key === "name") return a.name.localeCompare(b.name) * f;
  const av = a[key] ?? -Infinity;
  const bv = b[key] ?? -Infinity;
  return (av - bv) * f;
}
