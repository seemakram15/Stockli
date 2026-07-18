"use client";

import * as React from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, BadgeCheck, BadgeAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";
import { saveCdcDividends } from "@/lib/actions/dividends";
import type { ParsedFileResult } from "@/app/api/dividends/parse/route";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
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

export function ImportDividendsModal({ open, onOpenChange, portfolioId }: Props) {
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveResult, setSaveResult] = React.useState<{ saved: number; skipped: number; errors: string[] } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  function reset() {
    setEntries([]);
    setSaveResult(null);
    setSaving(false);
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
          prev.map((entry) =>
            pdfs.includes(entry.file)
              ? { ...entry, state: { status: "error", message: msg } }
              : entry
          )
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
        prev.map((entry) =>
          pdfs.includes(entry.file)
            ? { ...entry, state: { status: "error", message: msg } }
            : entry
        )
      );
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    void processFiles(files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    void processFiles(files);
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
              data: entry.state.result.data
                ? { ...entry.state.result.data, symbol: symbol.toUpperCase() }
                : undefined,
            },
          },
        };
      })
    );
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  const readyRecords = entries
    .filter((e): e is FileEntry & { state: { status: "done"; result: ParsedFileResult } } =>
      e.state.status === "done" && !!e.state.result.data
    )
    .map((e) => e.state.result.data!);

  const isParsing = entries.some((e) => e.state.status === "parsing");

  async function handleSave() {
    if (!readyRecords.length) return;
    setSaving(true);
    try {
      const result = await saveCdcDividends(portfolioId, readyRecords);
      setSaveResult(result);
    } catch (err) {
      setSaveResult({ saved: 0, skipped: 0, errors: [String(err)] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4 text-primary" />
            Import CDC Dividend Reports
          </DialogTitle>
        </DialogHeader>

        {saveResult ? (
          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-gain/30 bg-gain/5 p-4 text-center">
              <CheckCircle2 className="mx-auto mb-2 size-8 text-gain" />
              <p className="font-semibold text-foreground">
                {saveResult.saved} record{saveResult.saved !== 1 ? "s" : ""} imported
              </p>
              {saveResult.skipped > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">{saveResult.skipped} duplicate{saveResult.skipped !== 1 ? "s" : ""} skipped</p>
              )}
              {saveResult.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {saveResult.errors.map((e, i) => (
                    <p key={i} className="text-xs text-loss">{e}</p>
                  ))}
                </div>
              )}
            </div>
            <Button className="w-full" onClick={() => handleClose(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
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
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={onFileInputChange}
              />
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

            {readyRecords.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-border scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Symbol</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Gross</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">WHT</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {readyRecords.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-xs text-muted-foreground max-w-[140px] truncate">{r.companyName}</td>
                        <td className="px-3 py-2 font-mono text-xs font-medium">{r.symbol || "—"}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{r.paymentDate}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{formatPKR(r.grossAmount)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-loss">{formatPKR(r.taxDeducted)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums font-medium text-gain">{formatPKR(r.netAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={!readyRecords.length || isParsing || saving}
                onClick={handleSave}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {saving ? "Importing…" : `Import ${readyRecords.length} record${readyRecords.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3">
      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">{file.name}</p>
          {state.status === "parsing" && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
          {state.status === "done" && !state.result.error && <CheckCircle2 className="size-3.5 shrink-0 text-gain" />}
          {(state.status === "error" || (state.status === "done" && state.result.error)) && (
            <AlertCircle className="size-3.5 shrink-0 text-loss" />
          )}
        </div>

        {state.status === "done" && state.result.data && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">{state.result.data.companyName}</p>
            <div className="flex items-center gap-1.5">
              {state.result.data.symbolConfidence === "high" ? (
                <BadgeCheck className="size-3.5 shrink-0 text-gain" />
              ) : (
                <BadgeAlert className="size-3.5 shrink-0 text-amber-500" />
              )}
              <Input
                className="h-6 w-20 px-1.5 text-xs font-mono"
                value={state.result.data.symbol}
                placeholder="SYMBOL"
                onChange={(e) => onSymbolChange(e.target.value)}
              />
              {state.result.data.matchedCompanyName && (
                <p className="truncate text-[11px] text-muted-foreground">
                  → {state.result.data.matchedCompanyName}
                </p>
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

        {state.status === "error" && (
          <p className="text-xs text-loss">{state.message}</p>
        )}
        {state.status === "done" && state.result.error && (
          <p className="text-xs text-loss">{state.result.error}</p>
        )}
      </div>
      <button onClick={onRemove} className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
