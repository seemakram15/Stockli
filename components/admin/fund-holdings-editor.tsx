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
  ClipboardPaste,
  List,
  Pencil,
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

const OTHER_HOLDINGS_NAME = "Other Holdings";

function totalPct(rows: HoldingRow[]): number {
  return rows.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0);
}

function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${year}`;
}

// ─── Fuzzy ticker matching ────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "limited", "ltd", "corporation", "company", "pakistan", "pak", "pvt",
  "private", "industries", "industry", "inc", "co", "the", "and", "of",
]);

function normStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function matchTickerByName(name: string, tickers: Ticker[]): Ticker | null {
  const n = normStr(name);

  // 1. Exact symbol match
  const bySymbol = tickers.find((t) => t.symbol.toLowerCase() === n.toUpperCase().trim());
  if (bySymbol) return bySymbol;

  // 2. Exact normalized company name match
  const exactName = tickers.find((t) => normStr(t.companyName) === n);
  if (exactName) return exactName;

  // 3. Keyword scoring
  const words = n.split(" ").filter((w) => !STOP_WORDS.has(w) && w.length >= 3);
  if (words.length === 0) return null;

  let bestScore = 0;
  let bestTicker: Ticker | null = null;

  for (const t of tickers) {
    const tw = normStr(t.companyName)
      .split(" ")
      .filter((w) => !STOP_WORDS.has(w) && w.length >= 3);
    const hits = words.filter((w) => tw.some((x) => x.startsWith(w) || w.startsWith(x)));
    const score = hits.length / Math.max(words.length, tw.length);
    if (score > bestScore && score >= 0.55) {
      bestScore = score;
      bestTicker = t;
    }
  }

  return bestTicker;
}

function parsePastedHoldings(text: string, tickers: Ticker[]): HoldingRow[] {
  const rows: HoldingRow[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    // Strip leading rank: "1." "1)" "1 " "1: "
    const stripped = line.replace(/^\d{1,3}[.):\s]+/, "").trim();
    // Find trailing percentage (e.g. "12.50%" or "12.50")
    const pctMatch = stripped.match(/(\d{1,3}(?:\.\d{1,4})?)\s*%?\s*$/);
    if (!pctMatch) continue;
    const pct = parseFloat(pctMatch[1]);
    if (isNaN(pct)) continue;
    // Name is everything before the percentage, split by tab or 2+ spaces
    const nameRaw = stripped
      .slice(0, stripped.length - pctMatch[0].length)
      .replace(/[\t ]{2,}$/, "")
      .trim();
    if (!nameRaw) continue;

    // Special case: "Other Holdings" passes through with no ticker
    if (nameRaw.toLowerCase().replace(/\s+/g, " ").trim() === "other holdings") {
      rows.push({ symbol: null, stockName: OTHER_HOLDINGS_NAME, percentage: String(pct) });
      continue;
    }

    const match = matchTickerByName(nameRaw, tickers);
    rows.push({
      symbol: match?.symbol ?? null,
      stockName: match?.companyName ?? nameRaw,
      percentage: String(pct),
    });
  }
  return rows;
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
                    <CheckCircle2 className="size-3 text-primary-foreground" />
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

// ─── Per-row ticker dropdown ──────────────────────────────────────────────────

function TickerDropdown({
  tickers,
  symbol,
  stockName,
  onChange,
}: {
  tickers: Ticker[];
  symbol: string | null;
  stockName: string;
  onChange: (t: Ticker) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    return tickers
      .filter(
        (t) =>
          !q ||
          t.symbol.toLowerCase().includes(q) ||
          t.companyName.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [tickers, query]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex w-full min-w-0 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-accent/60 transition-colors"
        >
          {symbol ? (
            <span className="shrink-0 font-mono text-xs font-semibold text-primary w-16">
              {symbol}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-muted-foreground/50 w-16">—</span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">{stockName}</span>
          <Pencil className="size-3 shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-0" sideOffset={4}>
        <div className="border-b border-border p-2">
          <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ticker or name…"
              className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">No stocks found</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.symbol}
                type="button"
                onClick={() => { onChange(t); setOpen(false); setQuery(""); }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors",
                  t.symbol === symbol && "bg-primary/5 font-medium",
                )}
              >
                <span className="w-14 shrink-0 font-mono text-xs font-semibold text-primary">
                  {t.symbol}
                </span>
                <span className="min-w-0 truncate text-muted-foreground">{t.companyName}</span>
                {t.symbol === symbol && (
                  <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── AMC accent palette ───────────────────────────────────────────────────────

const AMC_ACCENTS = [
  { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-600 dark:text-violet-400", dot: "bg-violet-500", header: "from-violet-500/8 to-transparent" },
  { bg: "bg-sky-500/10",    border: "border-sky-500/30",    text: "text-sky-600 dark:text-sky-400",       dot: "bg-sky-500",    header: "from-sky-500/8 to-transparent" },
  { bg: "bg-emerald-500/10",border: "border-emerald-500/30",text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500",header: "from-emerald-500/8 to-transparent" },
  { bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-600 dark:text-amber-400",   dot: "bg-amber-500",  header: "from-amber-500/8 to-transparent" },
  { bg: "bg-rose-500/10",   border: "border-rose-500/30",   text: "text-rose-600 dark:text-rose-400",     dot: "bg-rose-500",   header: "from-rose-500/8 to-transparent" },
  { bg: "bg-teal-500/10",   border: "border-teal-500/30",   text: "text-teal-600 dark:text-teal-400",     dot: "bg-teal-500",   header: "from-teal-500/8 to-transparent" },
  { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500", header: "from-orange-500/8 to-transparent" },
  { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-600 dark:text-indigo-400", dot: "bg-indigo-500", header: "from-indigo-500/8 to-transparent" },
] as const;

// ─── Published Holdings Viewer ────────────────────────────────────────────────

function PublishedHoldingsViewer() {
  const amcList = getAmcList();
  const [amcFilter, setAmcFilter] = React.useState<string>("");
  const [yearFilter, setYearFilter] = React.useState<number>(0);
  const [monthFilter, setMonthFilter] = React.useState<number>(0);
  const [groups, setGroups] = React.useState<
    { amc: string; fundName: string; year: number; month: number; holdings: FundHolding[] }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const amcKeys = [...byAmc.keys()];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5 pb-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">AMC</label>
            <Select
              value={amcFilter}
              onValueChange={(v) => { setAmcFilter(v); applyFilters(v, yearFilter, monthFilter); }}
            >
              <SelectTrigger className="h-9 w-52">
                <SelectValue placeholder="All AMCs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All AMCs</SelectItem>
                {amcList.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Year</label>
            <Select
              value={String(yearFilter)}
              onValueChange={(v) => { const y = Number(v); setYearFilter(y); applyFilters(amcFilter, y, monthFilter); }}
            >
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All years</SelectItem>
                {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Month</label>
            <Select
              value={String(monthFilter)}
              onValueChange={(v) => { const m = Number(v); setMonthFilter(m); applyFilters(amcFilter, yearFilter, m); }}
            >
              <SelectTrigger className="h-9 w-28">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">All months</SelectItem>
                {MONTHS.map((label, i) => <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground"
            onClick={() => { setAmcFilter(""); setYearFilter(0); setMonthFilter(0); reload(); }}
          >
            <X className="size-3.5 mr-1.5" />
            Clear
          </Button>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground">{groups.length}</span> fund periods
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
          Loading holdings…
        </div>
      ) : groups.length === 0 ? (
        <div className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium text-muted-foreground">No published holdings found.</p>
          <p className="text-xs text-muted-foreground/60">Publish a fund period in the Edit Holdings tab.</p>
        </div>
      ) : (
        amcKeys.map((amc, amcIdx) => {
          const fundGroups = byAmc.get(amc)!;
          const accent = AMC_ACCENTS[amcIdx % AMC_ACCENTS.length];
          return (
            <div key={amc} className="space-y-2.5">
              {/* AMC header */}
              <div className="flex items-center gap-2.5 px-1">
                <div className={cn("size-2.5 rounded-full shrink-0", accent.dot)} />
                <h3 className={cn("text-xs font-bold uppercase tracking-widest", accent.text)}>
                  {amc}
                </h3>
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-[10px] text-muted-foreground/60">
                  {fundGroups.length} fund{fundGroups.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Fund accordions */}
              <div className="space-y-2">
                {fundGroups.map((fg) => {
                  const key = `${fg.fundName}||${fg.year}||${fg.month}`;
                  const open = expanded.has(key);
                  const total = fg.holdings.reduce((s, h) => s + h.percentage, 0);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "overflow-hidden rounded-xl border transition-shadow duration-200",
                        open ? cn("shadow-md", accent.border) : "border-border/60 hover:border-border"
                      )}
                    >
                      {/* Accordion header */}
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors duration-150",
                          open
                            ? cn("bg-gradient-to-r", accent.header, "bg-background")
                            : "bg-card hover:bg-muted/30"
                        )}
                        onClick={() => toggleExpand(key)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Colored left marker */}
                          <div className={cn("w-1 h-8 rounded-full shrink-0", accent.dot)} />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight truncate">{fg.fundName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", accent.bg, accent.text)}>
                                {MONTHS[fg.month - 1]} {fg.year}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {fg.holdings.length} stocks · {total.toFixed(1)}% disclosed
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 transition-transform duration-200",
                            open ? cn(accent.text) : "text-muted-foreground",
                            open && "rotate-180"
                          )}
                        />
                      </button>

                      {/* Expanded table */}
                      {open && (
                        <div className="border-t border-border/60">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className={cn("bg-gradient-to-r", accent.header, "bg-muted/10")}>
                                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 w-10">#</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 w-20">Ticker</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Company</th>
                                <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">% NAV</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {fg.holdings.map((h, i) => (
                                <tr key={h.id} className="group hover:bg-muted/20 transition-colors">
                                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground/60 font-mono">{i + 1}</td>
                                  <td className="px-4 py-2">
                                    {h.symbol ? (
                                      <span className={cn("font-mono text-xs font-bold px-1.5 py-0.5 rounded", accent.bg, accent.text)}>
                                        {h.symbol}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground/40">—</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-foreground/80 font-medium">{h.stockName}</td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center justify-end gap-2">
                                      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden hidden sm:block">
                                        <div
                                          className={cn("h-full rounded-full", accent.dot)}
                                          style={{ width: `${Math.min(100, (h.percentage / Math.max(total, 1)) * 100)}%`, opacity: 0.6 }}
                                        />
                                      </div>
                                      <span className="font-mono text-sm tabular-nums font-semibold w-14 text-right">
                                        {h.percentage.toFixed(2)}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-border/60 bg-muted/20">
                                <td colSpan={3} className="px-4 py-2.5 text-xs font-medium text-muted-foreground">
                                  {fg.holdings.length} stocks disclosed
                                </td>
                                <td className="px-4 py-2.5 text-right font-mono text-sm font-bold tabular-nums">
                                  {total.toFixed(2)}%
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
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
  const [otherHoldings, setOtherHoldings] = React.useState<string>("");
  const [isDirty, setIsDirty] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoadingPeriod, setIsLoadingPeriod] = React.useState(false);
  const [inputMode, setInputMode] = React.useState<"manual" | "paste">("manual");
  const [pasteText, setPasteText] = React.useState("");

  // ── Derived ──
  const total = totalPct(holdings);
  const otherPct = parseFloat(otherHoldings) || 0;
  const grandTotal = total + otherPct;
  const isOverAllocated = grandTotal > 100.005;
  const currentStatus = month
    ? periods.find((p) => p.year === year && p.month === month)?.status ?? null
    : null;

  // Find the most recent published period strictly before the selected one
  const latestPrevPublished = React.useMemo(() => {
    if (!month) return null;
    const curOrd = year * 12 + month;
    return periods
      .filter((p) => p.status === "published" && p.year * 12 + p.month < curOrd)
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month))[0] ?? null;
  }, [periods, year, month]);

  const canImport = latestPrevPublished !== null && holdings.length === 0 && !isDirty;

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
      setOtherHoldings("");
      setIsDirty(false);
      return;
    }
    getFundPeriods(fundName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundName]);

  async function getFundPeriods(name: string) {
    const { periods: p } = await loadFundPeriods(name);
    setPeriods(p);
  }

  // ── Load holdings when period changes ──
  React.useEffect(() => {
    if (!fundName || !month) {
      setHoldings([]);
      setOtherHoldings("");
      setIsDirty(false);
      return;
    }
    loadPeriod(fundName, year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundName, year, month]);

  async function loadPeriod(name: string, y: number, m: number) {
    setIsLoadingPeriod(true);
    const { holdings: h } = await loadPeriodHoldings(name, y, m);
    const otherRow = h.find((r) => r.stockName === OTHER_HOLDINGS_NAME);
    setOtherHoldings(otherRow ? String(otherRow.percentage) : "");
    setHoldings(h.filter((r) => r.stockName !== OTHER_HOLDINGS_NAME).map(holdingFromDB));
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

  function handleRowTickerChange(idx: number, t: Ticker) {
    setHoldings((prev) =>
      prev.map((row, i) =>
        i === idx ? { ...row, symbol: t.symbol, stockName: t.companyName } : row
      )
    );
    setIsDirty(true);
  }

  function handlePasteInsert() {
    const rows = parsePastedHoldings(pasteText, tickers);
    if (rows.length === 0) {
      toast.error("No holdings found in pasted text. Check the format.");
      return;
    }
    // Separate the Other Holdings row if present
    const otherRow = rows.find((r) => r.stockName === OTHER_HOLDINGS_NAME);
    const regular = rows.filter((r) => r.stockName !== OTHER_HOLDINGS_NAME);
    setHoldings(regular);
    if (otherRow) setOtherHoldings(otherRow.percentage);
    setIsDirty(true);
    setPasteText("");
    setInputMode("manual");
    toast.success(`Parsed ${regular.length} holdings${otherRow ? " + other holdings" : ""}`);
  }

  // ── Import from most recent published period ──
  async function handleImport() {
    if (!fundName || !latestPrevPublished) return;
    setIsLoadingPeriod(true);
    const { holdings: h } = await loadPeriodHoldings(fundName, latestPrevPublished.year, latestPrevPublished.month);
    const otherRow = h.find((r) => r.stockName === OTHER_HOLDINGS_NAME);
    setOtherHoldings(otherRow ? String(otherRow.percentage) : "");
    setHoldings(h.filter((r) => r.stockName !== OTHER_HOLDINGS_NAME).map(holdingFromDB));
    setIsDirty(true);
    setIsLoadingPeriod(false);
    toast.success(`Imported ${h.filter(r => r.stockName !== OTHER_HOLDINGS_NAME).length} holdings from ${monthLabel(latestPrevPublished.month, latestPrevPublished.year)}`);
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
    if (otherPct > 0) {
      payload.push({ symbol: null, stockName: OTHER_HOLDINGS_NAME, percentage: otherPct });
    }

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
      setOtherHoldings("");
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
      <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit shadow-sm">
        {(["edit", "published"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200",
              activeTab === tab
                ? tab === "edit"
                  ? "bg-violet-500 text-white shadow-sm shadow-violet-500/30"
                  : "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
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
      {periodSelected && canImport && latestPrevPublished && (
        <div className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-gradient-to-r from-sky-500/8 to-violet-500/5 px-4 py-3.5">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
              <Download className="size-4 text-sky-500" />
            </div>
            <div>
              <p className="font-medium text-foreground">Import from previous period</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-sky-600 dark:text-sky-400">
                  {monthLabel(latestPrevPublished.month, latestPrevPublished.year)}
                </span>
                {" "}has published holdings — import and adjust for this month.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-sky-500/30 bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400"
            onClick={handleImport}
            disabled={isLoadingPeriod}
          >
            <Download className="size-3.5" />
            Import holdings
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
            {/* Input mode toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 w-fit">
              <button
                type="button"
                onClick={() => setInputMode("manual")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  inputMode === "manual"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="size-3.5" />
                Manual
              </button>
              <button
                type="button"
                onClick={() => setInputMode("paste")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  inputMode === "paste"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ClipboardPaste className="size-3.5" />
                Paste
              </button>
            </div>

            {/* Manual mode: stock picker */}
            {inputMode === "manual" && (
              <StockPicker
                tickers={tickers}
                existingSymbols={existingSymbols}
                onAdd={handleAddStocks}
              />
            )}

            {/* Paste mode: textarea + insert */}
            {inputMode === "paste" && (
              <div className="space-y-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={10}
                  placeholder={`Paste holdings here, one per line:\n\nEngro Corporation Limited    8.50%\nOil & Gas Dev Company        6.20\nMari Petroleum               5.10%\nOther Holdings               3.00%\n\nFormat: Name[tab or 2+ spaces]Percentage`}
                  className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2.5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Separate name and percentage with a tab or 2+ spaces. Leading rank numbers (1. 2) etc.) are stripped automatically.
                  </p>
                  <Button
                    size="sm"
                    className="gap-1.5 shrink-0"
                    disabled={!pasteText.trim()}
                    onClick={handlePasteInsert}
                  >
                    <ClipboardPaste className="size-3.5" />
                    Insert
                  </Button>
                </div>
              </div>
            )}

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
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground" colSpan={2}>
                        Stock (click to change)
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
                        <td className="px-3 py-2" colSpan={2}>
                          <TickerDropdown
                            tickers={tickers}
                            symbol={row.symbol}
                            stockName={row.stockName}
                            onChange={(t) => handleRowTickerChange(idx, t)}
                          />
                        </td>
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
                    {/* Other Holdings — manually entered */}
                    <tr className="border-t border-border/60 bg-muted/10">
                      <td className="px-3 py-2">
                        {/* no remove button for this row */}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-muted-foreground/60 italic">—</span>
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        Other Holdings
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={otherHoldings}
                            onChange={(e) => { setOtherHoldings(e.target.value); setIsDirty(true); }}
                            className="h-7 w-24 text-right font-mono text-sm tabular-nums"
                            placeholder="0.00"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-t border-border bg-muted/30">
                      <td colSpan={3} className="px-3 py-2 text-xs font-medium text-muted-foreground">
                        Total — {holdings.length} stock{holdings.length !== 1 ? "s" : ""}{otherPct > 0 ? " + other holdings" : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={cn(
                            "font-mono text-sm font-semibold tabular-nums",
                            isOverAllocated
                              ? "text-destructive"
                              : grandTotal >= 99.9
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          )}
                        >
                          {grandTotal.toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Over-allocation warning */}
            {isOverAllocated && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0" />
                Total allocation is {grandTotal.toFixed(2)}% — exceeds 100%. Fix percentages before publishing.
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

      </>}
    </div>
  );
}
