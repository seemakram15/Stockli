"use client";

import * as React from "react";
import { ArrowDownUp, ExternalLink, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPKR,
  plColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FundClassFilter, MufapFund, MufapFundsData } from "@/lib/services/mufap";

type SortKey =
  | "name"
  | "amc"
  | "nav"
  | "d1"
  | "mtd"
  | "ytd"
  | "d365"
  | "profitOn100k";

type StrategyFilter = "all" | "stock" | "income" | "money-market" | "allocation";

const CLASS_FILTERS: Array<{ value: FundClassFilter; label: string }> = [
  { value: "all", label: "All funds" },
  { value: "islamic", label: "Islamic funds" },
  { value: "conventional", label: "Conventional funds" },
  { value: "pension", label: "Pension funds" },
];

const STRATEGY_FILTERS: Array<{ value: StrategyFilter; label: string }> = [
  { value: "all", label: "All strategies" },
  { value: "stock", label: "Stock funds" },
  { value: "money-market", label: "Money market" },
  { value: "income", label: "Income" },
  { value: "allocation", label: "Asset allocation" },
];

export function MufapFundsBoard({
  data,
  title,
  etfMode = false,
}: {
  data: MufapFundsData;
  title: string;
  etfMode?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [fundClass, setFundClass] = React.useState<FundClassFilter>("all");
  const [strategy, setStrategy] = React.useState<StrategyFilter>("all");
  const [amc, setAmc] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("d1");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.funds
      .filter((fund) => {
        const matchesQuery =
          !q ||
          fund.name.toLowerCase().includes(q) ||
          fund.amc.toLowerCase().includes(q) ||
          fund.type.toLowerCase().includes(q);
        const matchesClass = fundClass === "all" || fund.classFilter === fundClass;
        const matchesStrategy = strategy === "all" || strategyMatches(fund, strategy);
        const matchesAmc = amc === "all" || fund.amc === amc;
        const matchesType = type === "all" || fund.type === type;
        return matchesQuery && matchesClass && matchesStrategy && matchesAmc && matchesType;
      })
      .sort((a, b) => compareFunds(a, b, sortKey, sortDir));
  }, [amc, data.funds, fundClass, query, sortDir, sortKey, strategy, type]);

  const summary = React.useMemo(() => {
    const visible = rows.filter((fund) => fund.d1 != null);
    const avg1d = visible.length
      ? visible.reduce((sum, fund) => sum + (fund.d1 ?? 0), 0) / visible.length
      : 0;
    const best = [...visible].sort((a, b) => (b.d1 ?? 0) - (a.d1 ?? 0))[0] ?? null;
    const worst = [...visible].sort((a, b) => (a.d1 ?? 0) - (b.d1 ?? 0))[0] ?? null;
    return { avg1d, best, worst };
  }, [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "amc" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Funds" value={rows.length.toLocaleString("en-US")} />
        <Metric label="Average 1 day" value={formatPercent(summary.avg1d)} tone={summary.avg1d} />
        <Metric
          label="Best 1 day"
          value={summary.best ? `${summary.best.amcShort} ${formatPercent(summary.best.d1)}` : "—"}
          tone={summary.best?.d1}
        />
        <Metric
          label="Rs 100k P/L"
          value={formatPKR(rows.reduce((sum, fund) => sum + (fund.profitOn100k ?? 0), 0), { sign: true })}
          tone={rows.reduce((sum, fund) => sum + (fund.profitOn100k ?? 0), 0)}
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                MUFAP official data · updated {formatDateTime(data.updatedAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
              <Button asChild variant="outline">
                <a href={data.sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  MUFAP
                </a>
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {!etfMode && (
              <div className="flex flex-wrap gap-2">
                {CLASS_FILTERS.map((item) => (
                  <Button
                    key={item.value}
                    type="button"
                    variant={fundClass === item.value ? "default" : "outline"}
                    onClick={() => setFundClass(item.value)}
                    size="sm"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {STRATEGY_FILTERS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={strategy === item.value ? "secondary" : "outline"}
                  onClick={() => setStrategy(item.value)}
                  size="sm"
                >
                  {item.label}
                </Button>
              ))}
            </div>

            <div className="grid gap-2 lg:grid-cols-[1.5fr_1fr_1fr]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search fund name..."
                  className="pl-9"
                />
              </label>
              <Select value={amc} onValueChange={setAmc}>
                <SelectTrigger>
                  <SelectValue placeholder="AMC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All AMCs</SelectItem>
                  {data.amcs.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {data.types.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {data.amcs.slice(0, 10).map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setAmc(item)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    amc === item
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  <AmcIcon label={item} selected={amc === item} />
                  <span className="truncate">{shortLabel(item)}</span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 sm:px-2">
          <div className="overflow-x-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead label="Fund name" active={sortKey === "name"} onClick={() => toggleSort("name")} />
                  <SortableHead label="AMC" active={sortKey === "amc"} onClick={() => toggleSort("amc")} />
                  <TableHead>Type</TableHead>
                  <SortableHead label="NAV" active={sortKey === "nav"} onClick={() => toggleSort("nav")} align="right" />
                  <SortableHead label="1 day" active={sortKey === "d1"} onClick={() => toggleSort("d1")} align="right" />
                  <SortableHead label="MTD" active={sortKey === "mtd"} onClick={() => toggleSort("mtd")} align="right" />
                  <SortableHead label="YTD" active={sortKey === "ytd"} onClick={() => toggleSort("ytd")} align="right" />
                  <SortableHead label="365 days" active={sortKey === "d365"} onClick={() => toggleSort("d365")} align="right" />
                  <SortableHead label="Rs 100k P/L" active={sortKey === "profitOn100k"} onClick={() => toggleSort("profitOn100k")} align="right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((fund) => (
                  <TableRow key={`${fund.fundId ?? fund.name}-${fund.type}`}>
                    <TableCell>
                      <div>
                        {fund.fundId ? (
                          <Link
                            href={`/${etfMode ? "market/etfs" : "market/mutual-funds"}/${fund.fundId}`}
                            className="font-semibold hover:text-primary"
                          >
                            {fund.name}
                          </Link>
                        ) : (
                          <p className="font-semibold">{fund.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {fund.validityDate ?? "—"} · {fund.riskProfile ?? "Risk N/A"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{fund.amc}</TableCell>
                    <TableCell>{fund.type}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(fund.nav, 4)}</TableCell>
                    <ReturnCell value={fund.d1} />
                    <ReturnCell value={fund.mtd} />
                    <ReturnCell value={fund.ytd} />
                    <ReturnCell value={fund.d365} />
                    <TableCell className={cn("text-right font-semibold tabular-nums", plColorClass(fund.profitOn100k))}>
                      {formatPKR(fund.profitOn100k, { sign: true })}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">
                      No funds match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReturnCell({ value }: { value: number | null }) {
  return (
    <TableCell className={cn("text-right font-medium tabular-nums", plColorClass(value))}>
      {formatPercent(value)}
    </TableCell>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number | null;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold tabular-nums", plColorClass(tone))}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function SortableHead({
  label,
  active,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
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

function compareFunds(a: MufapFund, b: MufapFund, key: SortKey, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1;
  if (key === "name") return a.name.localeCompare(b.name) * factor;
  if (key === "amc") return a.amc.localeCompare(b.amc) * factor;
  return (numericValue(a, key) - numericValue(b, key)) * factor;
}

function numericValue(fund: MufapFund, key: SortKey) {
  if (key === "nav") return fund.nav ?? -Infinity;
  if (key === "d1") return fund.d1 ?? -Infinity;
  if (key === "mtd") return fund.mtd ?? -Infinity;
  if (key === "ytd") return fund.ytd ?? -Infinity;
  if (key === "d365") return fund.d365 ?? -Infinity;
  if (key === "profitOn100k") return fund.profitOn100k ?? -Infinity;
  return 0;
}

function shortLabel(value: string) {
  return value
    .replace(/Asset Management Company Limited|Asset Management Limited|Investment Management Limited|Investments Limited|Fund Management Limited|Fund Managers Limited|Limited/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function strategyMatches(fund: MufapFund, strategy: StrategyFilter) {
  const haystack = `${fund.name} ${fund.type} ${fund.category} ${fund.sector}`.toLowerCase();
  if (strategy === "stock") return /\b(stock|equity|index|sector)\b/.test(haystack);
  if (strategy === "money-market") return haystack.includes("money market") || haystack.includes("cash");
  if (strategy === "income") return haystack.includes("income") || haystack.includes("sovereign");
  return haystack.includes("asset allocation") || haystack.includes("balanced") || haystack.includes("allocation");
}

function AmcIcon({ label, selected }: { label: string; selected: boolean }) {
  const initials = shortLabel(label)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
        selected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
      )}
    >
      {initials || "AMC"}
    </span>
  );
}
