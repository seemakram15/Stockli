"use client";

import * as React from "react";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Loader2, X,
  BadgeCheck, BadgeAlert, Trash2, PlusCircle, FileUp, PenLine,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { cn } from "@/lib/utils";
import { saveCdcDividends } from "@/lib/actions/dividends";
import { markPortfolioMutated } from "@/lib/cache/portfolio-mutations";
import {
  calcCdcManualDividendAmounts,
  defaultTaxSettings,
  deriveCdcNetAmount,
  getWHTRate,
  recalcCdcAmountsFromGross,
} from "@/lib/services/tax";
import type { ParsedFileResult } from "@/app/api/dividends/parse/route";
import type { CdcParsedData, TaxSettings } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  taxSettings?: TaxSettings;
}

type FileState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "done"; result: ParsedFileResult }
  | { status: "error"; message: string };

interface FileEntry {
  file: File;
  state: FileState;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

const EMPTY_MANUAL: Omit<CdcParsedData, "symbolConfidence" | "matchedCompanyName"> = {
  symbol: "",
  companyName: "",
  warrantNo: "",
  issueDate: "",
  paymentDate: "",
  financialYear: "",
  ratePerSecurity: 0,
  noOfSecurities: 0,
  grossAmount: 0,
  zakatDeducted: 0,
  taxDeducted: 0,
  netAmount: 0,
  paymentStatus: "Paid",
};

export function ImportDividendsModal({ open, onOpenChange, portfolioId, taxSettings }: Props) {
  const [tab, setTab] = React.useState<"pdf" | "manual">("pdf");
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [manualRecords, setManualRecords] = React.useState<CdcParsedData[]>([]);
  const [manualForm, setManualForm] = React.useState({ ...EMPTY_MANUAL });
  const [saving, setSaving] = React.useState(false);
  const [saveResult, setSaveResult] = React.useState<{ saved: number; skipped: number; errors: string[] } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const settings = taxSettings ?? defaultTaxSettings();

  function reset() {
    setEntries([]);
    setManualRecords([]);
    setManualForm({ ...EMPTY_MANUAL });
    setSaveResult(null);
    setSaving(false);
    setTab("pdf");
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function processFiles(files: File[]) {
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"));
    if (!pdfs.length) return;

    const newEntries: FileEntry[] = pdfs.map((f) => ({ file: f, state: { status: "parsing" } }));
    setEntries((prev) => [...prev, ...newEntries]);

    const form = new FormData();
    pdfs.forEach((f) => form.append("file", f));

    try {
      const res = await fetch("/api/dividends/parse", { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        const msg = (() => { try { return JSON.parse(text)?.error ?? `Server error ${res.status}`; } catch { return `Server error ${res.status}`; } })();
        setEntries((prev) =>
          prev.map((entry) => pdfs.includes(entry.file) ? { ...entry, state: { status: "error", message: msg } } : entry)
        );
        return;
      }
      const json: { results: ParsedFileResult[] } = await res.json();
      setEntries((prev) =>
        prev.map((entry) => {
          const idx = pdfs.indexOf(entry.file);
          if (idx === -1) return entry;
          const result = json.results[idx];
          if (!result) return { ...entry, state: { status: "error", message: "No result returned" } };
          if (result.error) return { ...entry, state: { status: "error", message: result.error } };
          return { ...entry, state: { status: "done", result } };
        })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setEntries((prev) =>
        prev.map((entry) => pdfs.includes(entry.file) ? { ...entry, state: { status: "error", message: msg } } : entry)
      );
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    void processFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void processFiles(Array.from(e.dataTransfer.files));
  }

  function updateSymbol(fileIdx: number, symbol: string) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== fileIdx || entry.state.status !== "done") return entry;
        return {
          ...entry,
          state: {
            ...entry.state,
            result: {
              ...entry.state.result,
              data: entry.state.result.data ? { ...entry.state.result.data, symbol: symbol.toUpperCase() } : undefined,
            },
          },
        };
      })
    );
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeManualRecord(idx: number) {
    setManualRecords((prev) => prev.filter((_, i) => i !== idx));
  }

  function removePdfRecord(record: CdcParsedData) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.state.status !== "done" || entry.state.result.data !== record) return entry;
        return { ...entry, state: { status: "error", message: "Removed" } };
      })
    );
  }

  function handleManualField(field: keyof typeof EMPTY_MANUAL, value: string | number) {
    setManualForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "ratePerSecurity" || field === "noOfSecurities") {
        const rate = Number(field === "ratePerSecurity" ? value : next.ratePerSecurity);
        const qty = Number(field === "noOfSecurities" ? value : next.noOfSecurities);
        if (rate > 0 && qty > 0) {
          return { ...next, ...calcCdcManualDividendAmounts(rate, qty, settings) };
        }
        return next;
      }

      if (field === "grossAmount") {
        const gross = Number(value);
        if (gross > 0) {
          return { ...next, ...recalcCdcAmountsFromGross(gross, settings) };
        }
        return {
          ...next,
          netAmount: deriveCdcNetAmount(gross, next.zakatDeducted, next.taxDeducted),
        };
      }

      if (field === "zakatDeducted" || field === "taxDeducted") {
        const zakat = Number(field === "zakatDeducted" ? value : next.zakatDeducted);
        const wht = Number(field === "taxDeducted" ? value : next.taxDeducted);
        return {
          ...next,
          netAmount: deriveCdcNetAmount(next.grossAmount, zakat, wht),
        };
      }

      return next;
    });
  }

  function addManualRecord() {
    if (!manualForm.symbol || !manualForm.paymentDate) return;
    const netAmount = deriveCdcNetAmount(
      manualForm.grossAmount,
      manualForm.zakatDeducted,
      manualForm.taxDeducted
    );
    setManualRecords((prev) => [
      ...prev,
      { ...manualForm, netAmount, symbolConfidence: "none" as const },
    ]);
    setManualForm({ ...EMPTY_MANUAL });
  }

  const pdfRecords = entries
    .filter((e): e is FileEntry & { state: { status: "done"; result: ParsedFileResult } } =>
      e.state.status === "done" && !!e.state.result.data && !e.state.result.error
    )
    .map((e) => e.state.result.data!);

  const allRecords = [...pdfRecords, ...manualRecords];
  const isParsing = entries.some((e) => e.state.status === "parsing");

  async function handleSave() {
    if (!allRecords.length) return;
    setSaving(true);
    try {
      const result = await saveCdcDividends(portfolioId, allRecords);
      markPortfolioMutated({ portfolioId });
      setSaveResult(result);
    } catch (err) {
      setSaveResult({ saved: 0, skipped: 0, errors: [String(err)] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4 text-primary" />
            Import CDC Dividend Reports
          </DialogTitle>
        </DialogHeader>

        {saveResult ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-full max-w-sm rounded-xl border border-gain/30 bg-gain/5 p-6">
              <CheckCircle2 className="mx-auto mb-3 size-9 text-gain" />
              <p className="font-semibold text-foreground">
                {saveResult.saved} record{saveResult.saved !== 1 ? "s" : ""} imported
              </p>
              {saveResult.skipped > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {saveResult.skipped} duplicate{saveResult.skipped !== 1 ? "s" : ""} skipped
                </p>
              )}
              {saveResult.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {saveResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-loss">{e}</p>
                  ))}
                </div>
              )}
            </div>
            <Button className="w-full max-w-sm" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="mx-4 mt-3 flex shrink-0 gap-1 rounded-xl bg-muted/80 p-1 sm:mx-5">
              <TabBtn active={tab === "pdf"} onClick={() => setTab("pdf")} icon={<FileUp className="size-3.5" />}>
                Import PDF
              </TabBtn>
              <TabBtn active={tab === "manual"} onClick={() => setTab("manual")} icon={<PenLine className="size-3.5" />}>
                Add Manually
              </TabBtn>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {tab === "pdf" && (
                <div className="space-y-4 p-5 sm:p-6">
                  <div
                    className={cn(
                      "relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                      dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current?.click()}
                  >
                    <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={onFileInputChange} />
                    <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">Drop CDC PDF reports here</p>
                    <p className="mt-1 text-xs text-muted-foreground">or click to select — multiple files supported</p>
                  </div>

                  {entries.length > 0 && (
                    <div className="space-y-2">
                      {entries.map((entry, idx) => (
                        <FileRow
                          key={idx}
                          entry={entry}
                          onRemove={() => removeEntry(idx)}
                          onSymbolChange={(s) => updateSymbol(idx, s)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "manual" && (
                <div className="p-5 sm:p-6">
                  <ManualEntryForm
                    form={manualForm}
                    settings={settings}
                    onChange={handleManualField}
                    onAdd={addManualRecord}
                  />
                </div>
              )}

              {allRecords.length > 0 && (
                <div className="px-5 pb-5 sm:px-6 sm:pb-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Ready to import — {allRecords.length} record{allRecords.length !== 1 ? "s" : ""}
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-border scrollbar-thin">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Symbol</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Date</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Gross</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground text-cyan-500">Zakat</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">WHT</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Net</th>
                          <th className="w-8 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pdfRecords.map((r, i) => (
                          <PreviewRow key={`pdf-${i}`} record={r} onRemove={() => removePdfRecord(r)} />
                        ))}
                        {manualRecords.map((r, i) => (
                          <PreviewRow key={`manual-${i}`} record={r} onRemove={() => removeManualRecord(i)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:px-6">
              <Button variant="outline" className="sm:flex-1" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                className="sm:flex-1"
                disabled={!allRecords.length || isParsing || saving}
                onClick={handleSave}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {saving ? "Importing…" : `Import ${allRecords.length} record${allRecords.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabBtn({
  active, onClick, icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function FileRow({
  entry,
  onRemove,
  onSymbolChange,
}: {
  entry: FileEntry;
  onRemove: () => void;
  onSymbolChange: (s: string) => void;
}) {
  const { state, file } = entry;
  const isError = state.status === "error" || (state.status === "done" && !!state.result.error);

  return (
    <div className={cn(
      "flex items-start gap-2 rounded-lg border bg-card p-3",
      isError ? "border-loss/30" : "border-border"
    )}>
      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">{file.name}</p>
          {state.status === "parsing" && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
          {state.status === "done" && !state.result.error && <CheckCircle2 className="size-3.5 shrink-0 text-gain" />}
          {isError && <AlertCircle className="size-3.5 shrink-0 text-loss" />}
        </div>
        {state.status === "done" && state.result.data && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">{state.result.data.companyName}</p>
            <div className="flex items-center gap-1.5">
              {state.result.data.symbolConfidence === "high"
                ? <BadgeCheck className="size-3.5 shrink-0 text-gain" />
                : <BadgeAlert className="size-3.5 shrink-0 text-amber-500" />
              }
              <Input
                className="h-6 w-20 px-1.5 text-xs font-mono"
                value={state.result.data.symbol}
                placeholder="SYMBOL"
                onChange={(e) => onSymbolChange(e.target.value)}
              />
              {state.result.data.matchedCompanyName && (
                <p className="truncate text-[11px] text-muted-foreground">→ {state.result.data.matchedCompanyName}</p>
              )}
              {!state.result.data.matchedCompanyName && state.result.data.symbol && (
                <p className="text-[11px] text-amber-500">Unverified — check symbol</p>
              )}
              {!state.result.data.symbol && (
                <p className="text-[11px] text-loss">No match — enter symbol manually</p>
              )}
            </div>
          </div>
        )}
        {state.status === "error" && <p className="text-xs text-loss">{state.message}</p>}
        {state.status === "done" && state.result.error && <p className="text-xs text-loss">{state.result.error}</p>}
      </div>
      <button onClick={onRemove} className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function PreviewRow({ record, onRemove }: { record: CdcParsedData; onRemove: () => void }) {
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <tr className="hover:bg-muted/20">
      <td className="px-3 py-2 font-mono text-xs font-semibold">{record.symbol || "—"}</td>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{fmtDate(record.paymentDate)}</td>
      <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(record.grossAmount)}</td>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-cyan-500">
        {record.zakatDeducted > 0 ? fmt(record.zakatDeducted) : "—"}
      </td>
      <td className="px-3 py-2 text-right text-xs tabular-nums text-loss">{fmt(record.taxDeducted)}</td>
      <td className="px-3 py-2 text-right text-xs tabular-nums font-semibold text-gain">{fmt(record.netAmount)}</td>
      <td className="w-8 px-2 py-2 text-center">
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-loss transition-colors"
          title="Remove"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-loss">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ManualEntryForm({
  form,
  settings,
  onChange,
  onAdd,
}: {
  form: Omit<CdcParsedData, "symbolConfidence" | "matchedCompanyName">;
  settings: TaxSettings;
  onChange: (field: keyof typeof EMPTY_MANUAL, value: string | number) => void;
  onAdd: () => void;
}) {
  const num = (v: string) => parseFloat(v) || 0;
  const canAdd = !!form.symbol && !!form.paymentDate;
  const whtPct = Math.round(getWHTRate(settings.taxFiler) * 100);
  const zakatLabel = settings.zakatOnDividends ? "2.5% zakat" : "zakat off";

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Stock &amp; Period</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Symbol" required>
            <Input
              className="h-9 font-mono text-sm uppercase font-semibold"
              placeholder="e.g. OGDC"
              value={form.symbol}
              onChange={(e) => onChange("symbol", e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Payment Date" required>
            <DatePickerField
              value={form.paymentDate}
              onChange={(iso) => onChange("paymentDate", iso)}
              placeholder="Select date"
              buttonClassName="h-9"
              required
            />
          </Field>
          <div className="col-span-2 md:col-span-1">
            <Field label="Financial Year">
              <Input
                className="h-9 text-sm"
                placeholder="e.g. 2024-25"
                value={form.financialYear}
                onChange={(e) => onChange("financialYear", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Holdings</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rate / Share (Rs.)">
            <Input
              type="number" min="0" step="0.0001"
              className="h-9 text-sm"
              placeholder="e.g. 5.0000"
              value={form.ratePerSecurity || ""}
              onChange={(e) => onChange("ratePerSecurity", num(e.target.value))}
            />
          </Field>
          <Field label="No. of Securities">
            <Input
              type="number" min="0" step="1"
              className="h-9 text-sm"
              placeholder="e.g. 500"
              value={form.noOfSecurities || ""}
              onChange={(e) => onChange("noOfSecurities", parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
      </div>

      {/* Amounts */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Dividend Amounts (Rs.)</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="Gross Amount">
            <Input
              type="number" min="0" step="0.01"
              className="h-9 text-sm"
              placeholder="e.g. 2500.00"
              value={form.grossAmount || ""}
              onChange={(e) => onChange("grossAmount", num(e.target.value))}
            />
          </Field>
          <Field label="Zakat Deducted">
            <Input
              type="number" min="0" step="0.01"
              className="h-9 text-sm text-cyan-600 dark:text-cyan-400"
              placeholder="e.g. 0.00"
              value={form.zakatDeducted || ""}
              onChange={(e) => onChange("zakatDeducted", num(e.target.value))}
            />
          </Field>
          <Field label="WHT Deducted">
            <Input
              type="number" min="0" step="0.01"
              className="h-9 text-sm text-loss"
              placeholder="e.g. 750.00"
              value={form.taxDeducted || ""}
              onChange={(e) => onChange("taxDeducted", num(e.target.value))}
            />
          </Field>
          <Field label="Net Amount Paid">
            <Input
              type="number" min="0" step="0.01"
              readOnly
              tabIndex={-1}
              className="h-9 text-sm font-semibold text-gain bg-muted/40 cursor-default"
              placeholder="Gross − Zakat − WHT"
              value={form.netAmount || ""}
              aria-label="Net amount paid (derived)"
            />
          </Field>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Auto-fills from rate × securities using account settings ({whtPct}% WHT{settings.taxFiler ? " filer" : " non-filer"}, {zakatLabel}).
          Net is always Gross − Zakat − WHT; edit Gross/Zakat/WHT to adjust.
        </p>
      </div>

      <Button
        className="h-10 w-full gap-2"
        disabled={!canAdd}
        onClick={onAdd}
      >
        <PlusCircle className="size-4" />
        Add to import list
      </Button>
    </div>
  );
}
