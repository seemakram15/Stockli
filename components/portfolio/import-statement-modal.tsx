"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
  Trash2,
  Upload,
  FileText,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatNumber, formatPKR } from "@/lib/format";
import { markPortfolioMutated } from "@/lib/cache/portfolio-mutations";
import {
  importStatementTrades,
  type StatementImportTradeInput,
} from "@/lib/actions/portfolio";
import type {
  ParsedBrokerStatement,
  ParsedStatementTrade,
} from "@/lib/services/broker-statement-parser";
import type { StatementParseFileResult } from "@/app/api/portfolio/parse-statement/route";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  userId?: string | null;
}

type Step = "guidelines" | "review" | "done";

interface EditableTrade extends ParsedStatementTrade {
  included: boolean;
}

function toEditable(trades: ParsedStatementTrade[]): EditableTrade[] {
  return trades.map((t) => ({ ...t, included: true }));
}

export function ImportStatementModal({ open, onOpenChange, portfolioId, userId }: Props) {
  const [step, setStep] = React.useState<Step>("guidelines");
  const [parsing, setParsing] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<Pick<
    ParsedBrokerStatement,
    "brokerName" | "accountLabel" | "fromDate" | "toDate" | "charges" | "warnings"
  > | null>(null);
  const [trades, setTrades] = React.useState<EditableTrade[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saveErrors, setSaveErrors] = React.useState<string[]>([]);
  const [importedCount, setImportedCount] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setStep("guidelines");
    setParsing(false);
    setParseError(null);
    setMeta(null);
    setTrades([]);
    setFileName(null);
    setSaving(false);
    setSaveErrors([]);
    setImportedCount(0);
    setDragging(false);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function processFiles(files: FileList | File[]) {
    const list = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!list.length) {
      setParseError("Please upload a PDF Statement of Account.");
      return;
    }

    setParsing(true);
    setParseError(null);
    const form = new FormData();
    form.append("file", list[0]);

    try {
      const res = await fetch("/api/portfolio/parse-statement", { method: "POST", body: form });
      const json = (await res.json().catch(() => null)) as
        | { results?: StatementParseFileResult[]; error?: string }
        | null;
      if (!res.ok) {
        setParseError(json?.error ?? `Server error ${res.status}`);
        return;
      }
      const result = json?.results?.[0];
      if (!result) {
        setParseError("No parse result returned.");
        return;
      }
      if (result.error && !result.data?.trades?.length) {
        setParseError(result.error);
        return;
      }
      if (!result.data?.trades?.length) {
        setParseError(result.error ?? "No trades found in this statement.");
        return;
      }

      setFileName(result.fileName);
      setMeta({
        brokerName: result.data.brokerName,
        accountLabel: result.data.accountLabel,
        fromDate: result.data.fromDate,
        toDate: result.data.toDate,
        charges: result.data.charges,
        warnings: result.data.warnings,
      });
      setTrades(toEditable(result.data.trades));
      setStep("review");
      if (result.error) setParseError(result.error);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setParsing(false);
    }
  }

  function updateTrade(key: string, patch: Partial<EditableTrade>) {
    setTrades((prev) =>
      prev.map((t) => {
        if (t.key !== key) return t;
        const next = { ...t, ...patch };
        if (patch.quantity != null || patch.price != null) {
          next.tradeValue =
            Math.round((Number(next.quantity) || 0) * (Number(next.price) || 0) * 100) / 100;
        }
        return next;
      })
    );
  }

  function removeTrade(key: string) {
    setTrades((prev) => prev.filter((t) => t.key !== key));
  }

  const included = trades.filter((t) => t.included);
  const buyCount = included.filter((t) => t.side === "BUY").length;
  const sellCount = included.filter((t) => t.side === "SELL").length;
  const missingDates = included.filter((t) => !t.date).length;
  const missingSymbols = included.filter((t) => !t.symbol.trim()).length;

  async function approveImport() {
    if (!included.length) {
      setParseError("Select at least one trade to import.");
      return;
    }
    if (missingDates || missingSymbols) {
      setParseError("Every selected trade needs a symbol and date before approving.");
      return;
    }

    setSaving(true);
    setSaveErrors([]);
    const payload: StatementImportTradeInput[] = included.map((t) => ({
      side: t.side,
      symbol: t.symbol.trim().toUpperCase(),
      quantity: Number(t.quantity),
      price: Number(t.price),
      fees: Math.max(0, Number(t.fees) + Number(t.tax)),
      date: t.date,
      note: t.note || `${t.side} #${t.orderRef}`.trim(),
    }));

    try {
      const result = await importStatementTrades(portfolioId, payload);
      setSaveErrors(result.errors ?? []);
      setImportedCount(result.imported);
      if (result.imported > 0) {
        markPortfolioMutated({ portfolioId, userId: userId ?? undefined });
        setStep("done");
      } else {
        setParseError(result.error ?? "Nothing was imported.");
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[min(92vh,900px)] w-[calc(100vw-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:w-[min(96vw,72rem)] sm:max-w-6xl lg:max-w-7xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
          <DialogTitle>Import broker statement</DialogTitle>
          <DialogDescription>
            Extract BUY/SELL trades from your broker Statement of Account PDF. Files are parsed in
            memory and never stored on MyStockli.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void processFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {step === "guidelines" && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">Before you upload</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  <li>Use your broker account Statement of Account (PDF), not screenshots.</li>
                  <li>
                    Trades should look like{" "}
                    <span className="font-mono text-xs text-foreground">
                      T+1 BUY # 1091163 FFC 35 @ 576.07
                    </span>
                    .
                  </li>
                  <li>
                    We extract ticker, quantity, price, BUY/SELL side, order ref, and attributable
                    tax/fees when present (e.g. CGT tariff).
                  </li>
                  <li>
                    Review and edit every row before approving — nothing is saved until you confirm.
                    Sells always create transaction records even if share qty is short.
                  </li>
                  <li>Approved trades update holdings, avg cost, realized / unrealized P/L automatically.</li>
                </ul>
              </div>

              <div
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
                  dragging ? "border-primary bg-primary/5" : "border-border bg-card"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void processFiles(e.dataTransfer.files);
                }}
              >
                <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {parsing ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {parsing ? "Extracting trades…" : "Drop your statement PDF here"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">or choose a file from your device</p>
                <Button
                  type="button"
                  className="mt-4"
                  disabled={parsing}
                  onClick={() => inputRef.current?.click()}
                >
                  <FileUp className="size-4" />
                  Upload statement
                </Button>
              </div>

              {parseError ? (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {parseError}
                </p>
              ) : null}
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <FileText className="size-4 shrink-0" />
                    <span className="truncate">{fileName}</span>
                  </p>
                  {meta?.brokerName ? (
                    <p className="text-xs text-muted-foreground">{meta.brokerName}</p>
                  ) : null}
                  {meta?.accountLabel ? (
                    <p className="text-xs text-muted-foreground">{meta.accountLabel}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{included.length} selected</Badge>
                  <Badge variant="outline">{buyCount} buys</Badge>
                  <Badge variant="outline">{sellCount} sells</Badge>
                </div>
              </div>

              {meta?.warnings?.length ? (
                <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                  {meta.warnings.map((w) => (
                    <p key={w}>• {w}</p>
                  ))}
                </div>
              ) : null}

              {meta?.charges?.length ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Other ledger charges (not imported as trades)
                  </p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {meta.charges.map((c) => (
                      <li key={c.key} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{c.label}</span>
                        <span className="tabular-nums text-foreground">
                          {c.amount > 0 ? formatPKR(c.amount) : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    CGT is split across sells when detected — edit the Tax column per row if needed.
                    Tax + fees are saved into the trade fee field.
                  </p>
                </div>
              ) : null}

              {parseError ? (
                <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {parseError}
                </p>
              ) : null}

              <div className="space-y-3">
                {trades.map((t) => (
                  <TradeReviewCard
                    key={t.key}
                    trade={t}
                    onChange={(patch) => updateTrade(t.key, patch)}
                    onRemove={() => removeTrade(t.key)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="size-12 text-emerald-500" />
              <p className="mt-4 text-lg font-semibold text-foreground">
                Imported {importedCount} trade{importedCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Holdings, average cost, realized and unrealized P/L will refresh from the updated
                transaction history.
              </p>
              {saveErrors.length ? (
                <div className="mt-4 w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-800 dark:text-amber-200">
                  {saveErrors.map((e) => (
                    <p key={e}>• {e}</p>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {step === "guidelines" ? (
            <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          ) : null}
          {step === "review" ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={() => {
                  setStep("guidelines");
                  setTrades([]);
                  setMeta(null);
                  setParseError(null);
                }}
              >
                Back
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => inputRef.current?.click()}
                >
                  Re-upload
                </Button>
                <Button
                  type="button"
                  disabled={saving || !included.length || missingDates > 0 || missingSymbols > 0}
                  onClick={() => void approveImport()}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Approve &amp; import {included.length || ""}
                </Button>
              </div>
            </>
          ) : null}
          {step === "done" ? (
            <Button type="button" className="sm:ml-auto" onClick={() => handleClose(false)}>
              Done
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TradeReviewCard({
  trade,
  onChange,
  onRemove,
}: {
  trade: EditableTrade;
  onChange: (patch: Partial<EditableTrade>) => void;
  onRemove: () => void;
}) {
  const totalCost = trade.tradeValue + Number(trade.fees || 0) + Number(trade.tax || 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4",
        !trade.included && "opacity-55"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-border"
              checked={trade.included}
              onChange={(e) => onChange({ included: e.target.checked })}
            />
            <Badge
              className={cn(
                trade.side === "BUY"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              )}
            >
              {trade.side}
            </Badge>
          </label>
          <span className="text-base font-extrabold tracking-wide text-foreground sm:text-lg">
            {trade.symbol || "—"}
          </span>
          {trade.companyName ? (
            <span className="truncate text-sm font-bold text-foreground/90">{trade.companyName}</span>
          ) : null}
          {trade.confidence !== "high" ? (
            <Badge variant="outline" className="text-[10px]">
              check date
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden text-xs text-muted-foreground sm:inline">
            <Pencil className="mr-1 inline size-3" />
            editable
          </span>
          <Button type="button" size="icon-sm" variant="ghost" onClick={onRemove} aria-label="Remove row">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{trade.rawNarration}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Side">
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={trade.side}
            onChange={(e) => onChange({ side: e.target.value as "BUY" | "SELL" })}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </Field>
        <Field label="Ticker">
          <Input
            value={trade.symbol}
            onChange={(e) => onChange({ symbol: e.target.value.toUpperCase() })}
            className="h-9 uppercase"
          />
        </Field>
        <Field label="Qty">
          <Input
            type="number"
            min={0}
            step="any"
            value={trade.quantity}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
            className="h-9"
          />
        </Field>
        <Field label="Price">
          <Input
            type="number"
            min={0}
            step="any"
            value={trade.price}
            onChange={(e) => onChange({ price: Number(e.target.value) })}
            className="h-9"
          />
        </Field>
        <Field label="Fees">
          <Input
            type="number"
            min={0}
            step="any"
            value={trade.fees}
            onChange={(e) => onChange({ fees: Number(e.target.value) })}
            className="h-9"
          />
        </Field>
        <Field label="Tax / CGT">
          <Input
            type="number"
            min={0}
            step="any"
            value={trade.tax}
            onChange={(e) => onChange({ tax: Number(e.target.value) })}
            className="h-9"
          />
        </Field>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Field label="Date">
          <DatePickerField
            value={trade.date}
            onChange={(v) => onChange({ date: v })}
            buttonClassName="h-9"
          />
        </Field>
        <Field label="Note">
          <Input
            value={trade.note}
            onChange={(e) => onChange({ note: e.target.value })}
            className="h-9"
          />
        </Field>
        <div className="flex flex-col justify-end rounded-md border border-border bg-muted/20 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Trade value</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatPKR(trade.tradeValue)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            With fees/tax: {formatPKR(totalCost)} · {formatNumber(trade.quantity)} @{" "}
            {formatNumber(trade.price)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
