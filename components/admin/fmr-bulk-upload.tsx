"use client";

import * as React from "react";
import {
  FileText,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAmcList } from "@/lib/constants/pakistan-funds";
import { saveHoldings } from "@/lib/actions/fund-holdings";
import type { ParsedFund, ParsedHolding } from "@/lib/utils/fmr-parser";
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

interface EditableHolding {
  symbol: string;
  stockName: string;
  percentage: string;
}

interface FundResult {
  fundName: string;
  fileName: string;
  holdings: EditableHolding[];
  saveState: "idle" | "saving" | "saved" | "error";
  collapsed: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function totalPct(rows: EditableHolding[]): number {
  return rows.reduce((s, r) => s + (parseFloat(r.percentage) || 0), 0);
}

function fromParsed(h: ParsedHolding): EditableHolding {
  return {
    symbol: h.symbol ?? "",
    stockName: h.stockName,
    percentage: String(h.percentage),
  };
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({
  files,
  onFiles,
}: {
  files: File[];
  onFiles: (f: File[]) => void;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf"),
    );
    if (pdfs.length === 0) {
      toast.error("Only PDF files are accepted");
      return;
    }
    onFiles([...files, ...pdfs]);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <Upload className="size-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Drop FMR PDFs here or click to browse</p>
        <p className="text-xs text-muted-foreground">
          Multiple files supported — one per fund or one for the whole AMC
        </p>
      </div>
    </div>
  );
}

// ─── FundResultCard ───────────────────────────────────────────────────────────

function FundResultCard({
  result,
  year,
  month,
  tickers,
  onChange,
  onRemoveFund,
}: {
  result: FundResult;
  year: number;
  month: number;
  tickers: Ticker[];
  onChange: (updated: Partial<FundResult>) => void;
  onRemoveFund: () => void;
}) {
  const { fundName, holdings, saveState, collapsed } = result;
  const total = totalPct(holdings);
  const others = Math.max(0, 100 - total);
  const isOver = total > 100.005;

  function updateHolding(idx: number, patch: Partial<EditableHolding>) {
    const next = holdings.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    onChange({ holdings: next });
  }

  function removeHolding(idx: number) {
    onChange({ holdings: holdings.filter((_, i) => i !== idx) });
  }

  function addBlankRow() {
    onChange({
      holdings: [
        ...holdings,
        { symbol: "", stockName: "", percentage: "" },
      ],
    });
  }

  async function handleSave(status: "draft" | "published") {
    if (status === "published" && isOver) {
      toast.error("Total exceeds 100% — fix before publishing");
      return;
    }
    onChange({ saveState: "saving" });

    const payload = holdings
      .filter((h) => h.stockName.trim())
      .map((h) => ({
        symbol: h.symbol.trim() || null,
        stockName: h.stockName.trim(),
        percentage: parseFloat(h.percentage) || 0,
      }));

    const res = await saveHoldings(fundName, year, month, payload, status);
    if (res.ok) {
      onChange({ saveState: "saved" });
      toast.success(
        status === "published"
          ? `Published ${fundName} — ${MONTHS[month - 1]} ${year}`
          : `Draft saved for ${fundName}`,
      );
    } else {
      onChange({ saveState: "error" });
      toast.error(`${fundName}: ${res.error}`);
    }
  }

  const statusBadge =
    saveState === "saved" ? (
      <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Saved
      </Badge>
    ) : saveState === "error" ? (
      <Badge variant="outline" className="gap-1 border-destructive/30 text-destructive">
        <AlertTriangle className="size-3" /> Error
      </Badge>
    ) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ collapsed: !collapsed })}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {collapsed ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 truncate text-sm font-semibold">{fundName}</span>
          </button>
          <span className="shrink-0 text-xs text-muted-foreground">
            {holdings.length} holdings
          </span>
          {statusBadge}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {saveState !== "saved" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={saveState === "saving"}
                onClick={() => handleSave("draft")}
              >
                {saveState === "saving" ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Save className="size-3" />
                )}
                Draft
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    disabled={holdings.length === 0 || saveState === "saving" || isOver}
                  >
                    <Upload className="size-3" />
                    Publish
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Publish {fundName} — {MONTHS[month - 1]} {year}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will make {holdings.length} holdings publicly visible for{" "}
                      <strong>{fundName}</strong>.
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
            </>
          )}

          {saveState === "saved" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={() => onChange({ saveState: "idle" })}
            >
              <RefreshCw className="size-3" /> Edit
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-destructive"
            onClick={onRemoveFund}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="pt-0 pb-3 space-y-3">
          {/* source file label */}
          <p className="text-[11px] text-muted-foreground/60">
            Source: {result.fileName}
          </p>

          {/* holdings table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-8 px-2 py-1.5" />
                  <th className="w-24 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
                    Ticker
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
                    Company Name
                  </th>
                  <th className="w-32 px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">
                    % of NAV
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdings.map((row, idx) => (
                  <tr key={idx} className="group hover:bg-muted/20">
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => removeHolding(idx)}
                        className="flex size-5 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={row.symbol}
                        onChange={(e) =>
                          updateHolding(idx, { symbol: e.target.value.toUpperCase() })
                        }
                        placeholder="TICKER"
                        className="h-6 w-20 font-mono text-xs uppercase text-primary"
                        list={`tickers-${idx}`}
                      />
                      <datalist id={`tickers-${idx}`}>
                        {tickers.slice(0, 200).map((t) => (
                          <option key={t.symbol} value={t.symbol}>
                            {t.companyName}
                          </option>
                        ))}
                      </datalist>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        value={row.stockName}
                        onChange={(e) =>
                          updateHolding(idx, { stockName: e.target.value })
                        }
                        className="h-6 text-xs"
                        placeholder="Company name"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center justify-end gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={row.percentage}
                          onChange={(e) =>
                            updateHolding(idx, { percentage: e.target.value })
                          }
                          className="h-6 w-20 text-right font-mono text-xs tabular-nums"
                          placeholder="0.00"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t border-border bg-muted/30">
                  <td colSpan={3} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Total ({holdings.length} stocks)
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span
                      className={cn(
                        "font-mono text-sm font-semibold tabular-nums",
                        isOver
                          ? "text-destructive"
                          : total >= 99.9
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground",
                      )}
                    >
                      {total.toFixed(2)}%
                    </span>
                  </td>
                </tr>
                {!isOver && others > 0.005 && (
                  <tr className="border-t border-border/50">
                    <td colSpan={3} className="px-2 py-1 text-xs text-muted-foreground/60">
                      Others (not disclosed)
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-xs text-muted-foreground/60 tabular-nums">
                      {others.toFixed(2)}%
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {isOver && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="size-3.5 shrink-0" />
              Total is {total.toFixed(2)}% — exceeds 100%
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={addBlankRow}
          >
            <Plus className="size-3" /> Add row
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FmrBulkUpload({ tickers }: { tickers: Ticker[] }) {
  const amcList = getAmcList();

  // Config
  const [amc, setAmc] = React.useState("");
  const [fundType, setFundType] = React.useState<"conventional" | "islamic">("conventional");

  // Upload
  const [files, setFiles] = React.useState<File[]>([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);

  // Period
  const [year, setYear] = React.useState(CURRENT_YEAR);
  const [month, setMonth] = React.useState<number | null>(null);

  // Results
  const [fundResults, setFundResults] = React.useState<FundResult[]>([]);
  const hasResults = fundResults.length > 0;

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateFundResult(fundName: string, patch: Partial<FundResult>) {
    setFundResults((prev) =>
      prev.map((r) => (r.fundName === fundName ? { ...r, ...patch } : r)),
    );
  }

  function removeFundResult(fundName: string) {
    setFundResults((prev) => prev.filter((r) => r.fundName !== fundName));
  }

  async function handleParse() {
    if (!amc || !month || files.length === 0) return;
    setIsProcessing(true);
    setParseError(null);

    const fd = new FormData();
    fd.append("amc", amc);
    fd.append("type", fundType);
    files.forEach((f) => fd.append("files", f));

    try {
      const res = await fetch("/api/admin/parse-fmr", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      if (!res.ok) {
        setParseError(json.error ?? "Parse failed");
        return;
      }

      const parsed = (json.results as ParsedFund[]);
      if (parsed.length === 0) {
        // Log debug lines to console so developer can inspect the PDF format
        if (json._debug) {
          console.group("[FMR debug] No funds found. Extracted text sample:");
          console.log("Funds searched:", json._debug.fundsSearched);
          console.log("First 120 lines from PDF:");
          (json._debug.sampleLines as string[]).forEach((l: string, i: number) =>
            console.log(i, JSON.stringify(l))
          );
          console.groupEnd();
        }
        setParseError(
          "No fund holdings were found in the uploaded files. Check the browser console (F12) for extracted text to diagnose the PDF format.",
        );
        return;
      }

      setFundResults(
        parsed.map((r) => ({
          fundName: r.fundName,
          fileName: r.fileName,
          holdings: r.holdings.map(fromParsed),
          saveState: "idle",
          collapsed: false,
        })),
      );
    } catch (e) {
      setParseError("Network error — please try again");
    } finally {
      setIsProcessing(false);
    }
  }

  function reset() {
    setFiles([]);
    setFundResults([]);
    setParseError(null);
  }

  const canParse =
    amc !== "" && month !== null && files.length > 0 && !isProcessing;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 pb-4">
        <IconChip accent="sky" variant="soft">
          <FileText />
        </IconChip>
        <div>
          <CardTitle className="text-base">FMR Bulk Import</CardTitle>
          <p className="text-xs text-muted-foreground">
            Upload Fund Manager Report PDFs — system extracts holdings for all
            matching funds
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Step 1: Configuration ── */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* AMC */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AMC
            </label>
            <Select value={amc} onValueChange={(v) => { setAmc(v); setFundResults([]); setParseError(null); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select AMC…" />
              </SelectTrigger>
              <SelectContent>
                {amcList.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fund type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fund Type
            </label>
            <div className="flex h-9 items-center gap-1 rounded-lg border border-input p-1">
              {(["conventional", "islamic"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setFundType(t); setFundResults([]); setParseError(null); }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                    fundType === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Step 2: Period ── */}
        {amc && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Report Period
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
                <SelectTrigger className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((label, i) => {
                  const m = i + 1;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonth(m)}
                      className={cn(
                        "flex h-8 min-w-[2.8rem] items-center justify-center rounded-md border px-2.5 text-sm font-medium transition-colors",
                        month === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Upload ── */}
        {amc && month !== null && !hasResults && (
          <>
            <DropZone files={files} onFiles={setFiles} />

            {/* File list */}
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground/50 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {parseError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {parseError}
              </div>
            )}

            <Button
              className="gap-2"
              disabled={!canParse}
              onClick={handleParse}
            >
              {isProcessing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              {isProcessing ? "Extracting holdings…" : "Extract Holdings"}
            </Button>
          </>
        )}

        {/* ── Step 4: Results ── */}
        {hasResults && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {fundResults.length} fund{fundResults.length !== 1 ? "s" : ""} extracted
                <span className="ml-2 text-xs text-muted-foreground">
                  — {MONTHS[month! - 1]} {year}
                </span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground"
                onClick={reset}
              >
                <RefreshCw className="size-3" />
                New upload
              </Button>
            </div>

            <Separator />

            {fundResults.map((r) => (
              <FundResultCard
                key={r.fundName}
                result={r}
                year={year}
                month={month!}
                tickers={tickers}
                onChange={(patch) => updateFundResult(r.fundName, patch)}
                onRemoveFund={() => removeFundResult(r.fundName)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
