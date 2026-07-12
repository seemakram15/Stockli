"use client";

import * as React from "react";
import {
  PieChart,
  Plus,
  Trash2,
  Upload,
  Download,
  CheckCircle2,
  Clock,
  Search,
  X,
  AlertTriangle,
  ChevronDown,
  Save,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAmcList, getFundsByAmc } from "@/lib/constants/pakistan-funds";
import {
  loadFundPeriods,
  loadPeriodHoldings,
  saveHoldings,
  deleteHoldings,
  loadAllPublished,
} from "@/lib/actions/fund-holdings";
import type { FundPeriodStatus, FundHolding } from "@/lib/types/fund-holdings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FmrBulkUpload } from "@/components/admin/fmr-bulk-upload";
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
import { IconChip } from "@/components/ui/accent";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ticker {
  symbol: string;
  companyName: string;
}

interface HoldingRow {
  symbol: string | null;
  stockName: string;
  percentage: string; // string for controlled input
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function totalPct(rows: HoldingRow[]): number {
  return rows.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0);
}

function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

function holdingFromDB(h: FundHolding): HoldingRow {
  return {
    symbol: h.symbol,
    stockName: h.stockName,
    percentage: String(h.percentage),
  };
}

// ─── Fund Combobox ────────────────────────────────────────────────────────────

function FundCombobox({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const amcList = getAmcList();

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return amcList.map((amc) => ({ amc, funds: getFundsByAmc(amc) }));
    return amcList
      .map((amc) => ({
        amc,
        funds: getFundsByAmc(amc).filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            amc.toLowerCase().includes(q),
        ),
      }))
      .filter(({ funds }) => funds.length > 0);
  }, [query, amcList]);

  const totalVisible = filtered.reduce((s, g) => s + g.funds.length, 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full max-w-md items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            !value && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 truncate">
            {value || "Select a fund…"}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[420px] p-0"
      >
        {/* Search input */}
        <div className="border-b border-border p-2">
          <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by fund or AMC name…"
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground/60 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {totalVisible === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No funds found
            </p>
          )}
          {filtered.map(({ amc, funds }) => (
            <div key={amc}>
              <p className="sticky top-0 bg-popover px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {amc}
              </p>
              {funds.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => {
                    onSelect(f.name);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    value === f.name && "bg-primary/8 font-medium text-primary",
                  )}
                >
                  {f.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MonthButton({
  label,
  active,
  status,
  onClick,
}: {
  label: string;
  active: boolean;
  status: "none" | "draft" | "published";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-9 min-w-[3.5rem] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "border border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
      {status !== "none" && (
        <span
          className={cn(
            "absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-background",
            status === "published" ? "bg-emerald-500" : "bg-amber-400"
          )}
        />
      )}
    </button>
  );
}

function StockPicker({
  tickers,
  existingSymbols,
  onAdd,
}: {
  tickers: Ticker[];
  existingSymbols: Set<string | null>;
  onAdd: (selected: Ticker[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  // ordered array to preserve selection order
  const [selected, setSelected] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    return tickers
      .filter((t) => !existingSymbols.has(t.symbol))
      .filter(
        (t) =>
          !q ||
          t.symbol.toLowerCase().includes(q) ||
          t.companyName.toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [tickers, existingSymbols, query]);

  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  function toggle(symbol: string) {
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  }

  function handleAdd() {
    if (selected.length === 0) return;
    // Build ticker lookup for O(1) access
    const bySymbol = new Map(tickers.map((t) => [t.symbol, t]));
    const picks = selected.map((sym) => bySymbol.get(sym)!).filter(Boolean);
    onAdd(picks);
    setSelected([]);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 min-w-[260px] justify-between gap-2 font-normal"
          >
            <span className="text-muted-foreground">
              {selected.length > 0
                ? `${selected.length} stock${selected.length !== 1 ? "s" : ""} selected`
                : "Search & select stocks…"}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[340px] p-0"
          sideOffset={4}
        >
          <div className="border-b border-border p-2">
            <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ticker or company name…"
                className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No stocks found
              </p>
            )}
            {filtered.map((t) => (
              <button
                key={t.symbol}
                type="button"
                onClick={() => toggle(t.symbol)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  selectedSet.has(t.symbol) && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    selectedSet.has(t.symbol)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  )}
                >
                  {selectedSet.has(t.symbol) && (
                    <svg viewBox="0 0 10 8" className="size-2.5 fill-current">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="w-14 shrink-0 font-mono text-xs font-medium text-primary">
                  {t.symbol}
                </span>
                <span className="min-w-0 truncate text-muted-foreground">
                  {t.companyName}
                </span>
              </button>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-border p-2">
              <Button size="sm" className="w-full" onClick={handleAdd}>
                Add {selected.length} stock{selected.length !== 1 ? "s" : ""}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        disabled={open}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Add
      </Button>
    </div>
  );
}

// ─── Published Holdings Viewer ────────────────────────────────────────────────

function PublishedHoldingsViewer() {
  const amcList = getAmcList();
  const [amcFilter, setAmcFilter] = React.useState<string>("");
  const [yearFilter, setYearFilter] = React.useState<number>(0);
  const [monthFilter, setMonthFilter] = React.useState<number>(0);
  const [groups, setGroups] = React.useState<
    { amc: string; fundName: string; year: number; month: number; holdings: FundHolding[] }[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  async function reload(amc?: string, year?: number, month?: number) {
    setLoading(true);
    const { groups: g } = await loadAllPublished({
      amc: amc || undefined,
      year: year || undefined,
      month: month || undefined,
    });
    setGroups(g);
    setLoading(false);
  }

  React.useEffect(() => {
    reload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function applyFilters(amc: string, year: number, month: number) {
    reload(amc, year, month);
  }

  // Group by AMC
  const byAmc = React.useMemo(() => {
    const map = new Map<string, typeof groups>();
    for (const g of groups) {
      const list = map.get(g.amc) ?? [];
      list.push(g);
      map.set(g.amc, list);
    }
    return map;
  }, [groups]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AMC</label>
            <Select
              value={amcFilter}
              onValueChange={(v) => {
                setAmcFilter(v);
                applyFilters(v, yearFilter, monthFilter);
              }}
            >
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="All AMCs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All AMCs</SelectItem>
                {amcList.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Year</label>
            <Select
              value={String(yearFilter)}
              onValueChange={(v) => {
                const y = Number(v);
                setYearFilter(y);
                applyFilters(amcFilter, y, monthFilter);
              }}
            >
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All years</SelectItem>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Month</label>
            <Select
              value={String(monthFilter)}
              onValueChange={(v) => {
                const m = Number(v);
                setMonthFilter(m);
                applyFilters(amcFilter, yearFilter, m);
              }}
            >
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All months</SelectItem>
                {MONTHS.map((label, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground"
            onClick={() => {
              setAmcFilter("");
              setYearFilter(0);
              setMonthFilter(0);
              reload();
            }}
          >
            Clear
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : groups.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No published holdings found.
        </div>
      ) : (
        [...byAmc.entries()].map(([amc, fundGroups]) => (
          <div key={amc} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {amc}
            </h3>
            {fundGroups.map((fg) => {
              const key = `${fg.fundName}||${fg.year}||${fg.month}`;
              const open = expanded.has(key);
              return (
                <Card key={key} className="overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => toggleExpand(key)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{fg.fundName}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {MONTHS[fg.month - 1]} {fg.year}
                      </span>
                      <span className="text-xs text-muted-foreground">{fg.holdings.length} stocks</span>
                    </div>
                    <ChevronDown
                      className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30">
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Ticker</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">% NAV</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {fg.holdings.map((h, i) => (
                            <tr key={h.id} className="hover:bg-muted/20">
                              <td className="px-4 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                              <td className="px-4 py-1.5">
                                {h.symbol ? (
                                  <span className="font-mono text-xs font-semibold text-primary">{h.symbol}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-1.5 text-sm text-foreground/80">{h.stockName}</td>
                              <td className="px-4 py-1.5 text-right font-mono text-sm tabular-nums">{h.percentage.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-border bg-muted/30">
                            <td colSpan={3} className="px-4 py-2 text-xs text-muted-foreground">
                              {fg.holdings.length} stocks
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs font-semibold tabular-nums">
                              {fg.holdings.reduce((s, h) => s + h.percentage, 0).toFixed(2)}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export function FundHoldingsEditor({ tickers }: { tickers: Ticker[] }) {
  const [activeTab, setActiveTab] = React.useState<"edit" | "published">("edit");

  // ── Selection state ──
  const [fundName, setFundName] = React.useState<string>("");
  const [year, setYear] = React.useState<number>(CURRENT_YEAR);
  const [month, setMonth] = React.useState<number | null>(null);

  // ── Data state ──
  const [periods, setPeriods] = React.useState<FundPeriodStatus[]>([]);
  const [holdings, setHoldings] = React.useState<HoldingRow[]>([]);
  const [isDirty, setIsDirty] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoadingPeriod, setIsLoadingPeriod] = React.useState(false);

  const amcList = getAmcList();

  // ── Derived ──
  const total = totalPct(holdings);
  const others = Math.max(0, 100 - total);
  const isOverAllocated = total > 100.005;
  const currentStatus = month
    ? periods.find((p) => p.year === year && p.month === month)?.status ?? null
    : null;
  const prev = month ? prevMonth(year, month) : null;
  const prevPeriodStatus = prev
    ? periods.find((p) => p.year === prev.year && p.month === prev.month)?.status ?? null
    : null;
  const canImport = prevPeriodStatus === "published" && holdings.length === 0 && !isDirty;

  const existingSymbols = React.useMemo(
    () => new Set(holdings.map((h) => h.symbol)),
    [holdings]
  );

  // ── Load periods when fund changes ──
  React.useEffect(() => {
    if (!fundName) {
      setPeriods([]);
      setMonth(null);
      setHoldings([]);
      setIsDirty(false);
      return;
    }
    getFundPeriods(fundName);
  }, [fundName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function getFundPeriods(name: string) {
    const { periods: p } = await loadFundPeriods(name);
    setPeriods(p);
  }

  // ── Load holdings when period changes ──
  React.useEffect(() => {
    if (!fundName || !month) {
      setHoldings([]);
      setIsDirty(false);
      return;
    }
    loadPeriod(fundName, year, month);
  }, [fundName, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPeriod(name: string, y: number, m: number) {
    setIsLoadingPeriod(true);
    const { holdings: h } = await loadPeriodHoldings(name, y, m);
    setHoldings(h.map(holdingFromDB));
    setIsDirty(false);
    setIsLoadingPeriod(false);
  }

  // ── Stock add ──
  function handleAddStocks(picks: Ticker[]) {
    setHoldings((prev) => [
      ...prev,
      ...picks.map((t) => ({
        symbol: t.symbol,
        stockName: t.companyName,
        percentage: "",
      })),
    ]);
    setIsDirty(true);
  }

  // ── Row change ──
  function handlePctChange(idx: number, value: string) {
    setHoldings((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, percentage: value } : row
      )
    );
    setIsDirty(true);
  }

  function handleRemove(idx: number) {
    setHoldings((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  }

  // ── Import from previous month ──
  async function handleImport() {
    if (!fundName || !prev) return;
    setIsLoadingPeriod(true);
    const { holdings: h } = await loadPeriodHoldings(fundName, prev.year, prev.month);
    setHoldings(h.map(holdingFromDB));
    setIsDirty(true);
    setIsLoadingPeriod(false);
    toast.success(`Imported ${h.length} holdings from ${monthLabel(prev.month, prev.year)}`);
  }

  // ── Save / Publish ──
  async function handleSave(status: "draft" | "published") {
    if (!fundName || !month) return;
    if (status === "published" && isOverAllocated) {
      toast.error("Total allocation exceeds 100%. Please fix before publishing.");
      return;
    }
    setIsSaving(true);
    const payload = holdings
      .filter((h) => h.stockName.trim())
      .map((h) => ({
        symbol: h.symbol,
        stockName: h.stockName.trim(),
        percentage: parseFloat(h.percentage) || 0,
      }));

    const result = await saveHoldings(fundName, year, month, payload, status);
    if (result.ok) {
      toast.success(
        status === "published"
          ? `Published ${payload.length} holdings for ${monthLabel(month, year)}`
          : `Draft saved for ${monthLabel(month, year)}`
      );
      setIsDirty(false);
      // Refresh period statuses
      const { periods: p } = await loadFundPeriods(fundName);
      setPeriods(p);
    } else {
      toast.error(result.error);
    }
    setIsSaving(false);
  }

  // ── Delete period ──
  async function handleDelete() {
    if (!fundName || !month) return;
    const result = await deleteHoldings(fundName, year, month);
    if (result.ok) {
      toast.success(`Deleted holdings for ${monthLabel(month, year)}`);
      setHoldings([]);
      setIsDirty(false);
      const { periods: p } = await loadFundPeriods(fundName);
      setPeriods(p);
    } else {
      toast.error(result.error);
    }
  }

  // ── Render ──
  const periodSelected = fundName && month !== null;

  return (
    <div className="space-y-5">
      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1 w-fit">
        {(["edit", "published"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "edit" ? <PieChart className="size-3.5" /> : <Eye className="size-3.5" />}
            {tab === "edit" ? "Edit Holdings" : "Published Holdings"}
          </button>
        ))}
      </div>

      {activeTab === "published" && <PublishedHoldingsViewer />}
      {activeTab === "edit" && <>

      {/* ── Section 1: Fund & Period ── */}
      <Card>
        <CardHeader className="flex-row items-center gap-3 pb-4">
          <IconChip accent="violet" variant="soft">
            <PieChart />
          </IconChip>
          <CardTitle className="text-base">Select Fund & Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Fund selector — searchable combobox */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Mutual Fund
            </label>
            <FundCombobox
              value={fundName}
              onSelect={(name) => {
                setFundName(name);
                setMonth(null);
                setHoldings([]);
                setIsDirty(false);
              }}
            />
          </div>

          {/* Year + Month selectors */}
          {fundName && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Year
                  </label>
                  <Select
                    value={String(year)}
                    onValueChange={(v) => {
                      setYear(Number(v));
                      setMonth(null);
                      setHoldings([]);
                      setIsDirty(false);
                    }}
                  >
                    <SelectTrigger className="h-9 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {YEAR_OPTIONS.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Month pills */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Month
                </label>
                <div className="flex flex-wrap gap-2">
                  {MONTHS.map((label, i) => {
                    const m = i + 1;
                    const status =
                      periods.find((p) => p.year === year && p.month === m)
                        ?.status ?? "none";
                    return (
                      <MonthButton
                        key={m}
                        label={label}
                        active={month === m}
                        status={status as "none" | "draft" | "published"}
                        onClick={() => {
                          if (isDirty) {
                            if (!confirm("Discard unsaved changes?")) return;
                          }
                          setMonth(m);
                          setHoldings([]);
                          setIsDirty(false);
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 pt-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block size-2 rounded-full bg-emerald-500" />
                    Published
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="inline-block size-2 rounded-full bg-amber-400" />
                    Draft
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Import Banner ── */}
      {periodSelected && canImport && prev && (
        <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Download className="size-4 text-sky-500" />
            <span className="text-foreground">
              Previous month (
              <span className="font-medium">{monthLabel(prev.month, prev.year)}</span>
              ) has published data.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 border-sky-500/30 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400"
            onClick={handleImport}
            disabled={isLoadingPeriod}
          >
            <Download className="size-3.5" />
            Import
          </Button>
        </div>
      )}

      {/* ── Section 2: Holdings Editor ── */}
      {periodSelected && (

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
            <div className="flex items-center gap-3">
              <IconChip accent="emerald" variant="soft">
                <PieChart />
              </IconChip>
              <div>
                <CardTitle className="text-base">
                  Holdings — {fundName}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {month && `${MONTHS[month - 1]} ${year}`}
                  {currentStatus && (
                    <span
                      className={cn(
                        "ml-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        currentStatus === "published"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {currentStatus === "published" ? (
                        <CheckCircle2 className="size-2.5" />
                      ) : (
                        <Clock className="size-2.5" />
                      )}
                      {currentStatus}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Delete button — only shown when period has saved data */}
            {currentStatus && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                    Delete period
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete holdings for {month && monthLabel(month, year)}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove all {holdings.length} holdings for{" "}
                      <strong>{fundName}</strong> — {month && monthLabel(month, year)}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Stock picker */}
            <StockPicker
              tickers={tickers}
              existingSymbols={existingSymbols}
              onAdd={handleAddStocks}
            />

            {/* Holdings table */}
            {isLoadingPeriod ? (
              <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : holdings.length === 0 ? (
              <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">No holdings added yet.</p>
                <p className="text-xs text-muted-foreground/60">
                  Use the search above to add stocks.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="w-8 px-3 py-2" />
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Ticker
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Company Name
                      </th>
                      <th className="w-36 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                        % of NAV
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {holdings.map((row, idx) => (
                      <tr key={idx} className="group transition-colors hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleRemove(idx)}
                            className="flex size-5 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          >
                            <X className="size-3.5" />
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {row.symbol ? (
                            <span className="font-mono text-xs font-semibold text-primary">
                              {row.symbol}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-foreground/80">{row.stockName}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              value={row.percentage}
                              onChange={(e) => handlePctChange(idx, e.target.value)}
                              className="h-7 w-24 text-right font-mono text-sm tabular-nums"
                              placeholder="0.00"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Summary footer */}
                  <tfoot>
                    <tr className="border-t border-border bg-muted/30">
                      <td colSpan={3} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        Total ({holdings.length} stocks)
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={cn(
                            "font-mono text-sm font-semibold tabular-nums",
                            isOverAllocated
                              ? "text-destructive"
                              : total >= 99.9
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          )}
                        >
                          {total.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                    {!isOverAllocated && others > 0.005 && (
                      <tr className="border-t border-border/50">
                        <td colSpan={3} className="px-3 py-1.5 text-xs text-muted-foreground/70">
                          Others (not disclosed)
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground/70 tabular-nums">
                          {others.toFixed(2)}%
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            )}

            {/* Over-allocation warning */}
            {isOverAllocated && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                Total allocation is {total.toFixed(2)}% — exceeds 100%. Fix percentages before publishing.
              </div>
            )}

            <Separator />

            {/* Action bar */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={!isDirty || isSaving}
                onClick={() => {
                  if (fundName && month) loadPeriod(fundName, year, month);
                }}
              >
                Discard changes
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!isDirty || isSaving}
                  onClick={() => handleSave("draft")}
                >
                  <Save className="size-3.5" />
                  Save draft
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={holdings.length === 0 || isSaving || isOverAllocated}
                    >
                      <Upload className="size-3.5" />
                      {currentStatus === "published" ? "Update & Publish" : "Publish"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Publish holdings for {month && monthLabel(month, year)}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {currentStatus === "published"
                          ? `This will overwrite the existing published data for ${fundName} — ${month && monthLabel(month, year)} with ${holdings.length} holdings.`
                          : `This will make ${holdings.length} holdings for ${fundName} — ${month && monthLabel(month, year)} publicly visible.`}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleSave("published")}>
                        Publish
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: FMR Bulk Import ── */}
      <FmrBulkUpload tickers={tickers} />
      </>}
    </div>
  );
}
