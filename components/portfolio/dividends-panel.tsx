"use client";

import * as React from "react";
import Link from "next/link";
import { Banknote, Upload, TrendingUp, Receipt, Landmark, Coins, Trash2 } from "lucide-react";
import { markPortfolioMutated } from "@/lib/cache/portfolio-mutations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { formatPKR, formatDate, formatNumber } from "@/lib/format";
import { ImportDividendsModal } from "@/components/portfolio/import-dividends-modal";
import { deleteCdcDividend } from "@/lib/actions/dividends";
import type { DividendIncomeSummary, TaxSettings, ReceivedDividend } from "@/lib/types";

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: "green" | "red" | "cyan" | "gold";
}) {
  const styles = {
    green: { border: "border-t-gain", icon: "bg-gain/10 text-gain" },
    red:   { border: "border-t-loss", icon: "bg-loss/10 text-loss" },
    cyan:  { border: "border-t-cyan-500", icon: "bg-cyan-500/10 text-cyan-500" },
    gold:  { border: "border-t-amber-500", icon: "bg-amber-500/10 text-amber-500" },
  }[accent];

  return (
    <div className={`rounded-xl border border-border border-t-2 bg-card p-4 ${styles.border}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <span className={`flex size-7 items-center justify-center rounded-lg ${styles.icon}`}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function DividendsPanel({
  dividendIncome,
  portfolioId,
}: {
  dividendIncome: DividendIncomeSummary;
  taxSettings?: TaxSettings;
  portfolioId: string;
}) {
  const [importOpen, setImportOpen] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const { received, upcoming, totalGross, totalWHT, totalZakat, totalNet } = dividendIncome;
  const hasReceived = received.length > 0;
  const hasUpcoming = upcoming.length > 0;
  const showZakat = totalZakat > 0;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteCdcDividend(id, portfolioId);
      markPortfolioMutated({ portfolioId });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <ImportDividendsModal open={importOpen} onOpenChange={setImportOpen} portfolioId={portfolioId} />

      <div className="space-y-6 p-4">
        {!hasReceived && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
              <Banknote className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No dividend records yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Import your CDC Dividend / Zakat &amp; Tax reports to track actual received dividends with official tax figures.
              </p>
            </div>
            <Button onClick={() => setImportOpen(true)} className="gap-2">
              <Upload className="size-4" />
              Import CDC Reports
            </Button>
          </div>
        )}

        {hasReceived && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard label="Total gross" value={formatPKR(totalGross)} icon={TrendingUp} accent="green" />
              <SummaryCard label="WHT deducted" value={formatPKR(totalWHT)} icon={Receipt} accent="red" />
              <SummaryCard label="Zakat" value={formatPKR(totalZakat)} icon={Landmark} accent="cyan" />
              <SummaryCard label="Net received" value={formatPKR(totalNet)} icon={Coins} accent="gold" />
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Received dividends
                </h3>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setImportOpen(true)}>
                  <Upload className="size-3" />
                  Import more
                </Button>
              </div>

              <div className="space-y-3 sm:hidden">
                {received.map((r, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-primary">
                            {r.symbol}
                          </Link>
                          {r.financialYear && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">FY{r.financialYear}</Badge>
                          )}
                        </div>
                        {r.companyName && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.companyName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{formatDate(r.creditedOn)}</span>
                        {r.id && (
                          <DeleteDividendButton
                            record={r}
                            deleting={deletingId === r.id}
                            onConfirm={() => handleDelete(r.id!)}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                      <div>
                        <p className="text-[11px] text-muted-foreground">Rate / Share</p>
                        <p className="tabular-nums font-medium">{formatPKR(r.perShare)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Securities</p>
                        <p className="tabular-nums font-medium">{formatNumber(r.quantityHeld, 0)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Gross dividend</p>
                        <p className="tabular-nums font-medium">{formatPKR(r.grossAmount)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-muted-foreground">Tax (WHT)</p>
                        <p className="tabular-nums font-medium text-loss">{formatPKR(r.whtAmount)}</p>
                      </div>
                      {r.zakatAmount > 0 && (
                        <div>
                          <p className="text-[11px] text-muted-foreground">Zakat</p>
                          <p className="tabular-nums font-medium text-muted-foreground">{formatPKR(r.zakatAmount)}</p>
                        </div>
                      )}
                      <div className={r.zakatAmount > 0 ? "text-right" : "col-span-2 text-right"}>
                        <p className="text-[11px] text-muted-foreground">Amount paid</p>
                        <p className="tabular-nums text-base font-semibold text-gain">{formatPKR(r.netAmount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-xl border border-border scrollbar-thin sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Company</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Rate / Share</TableHead>
                      <TableHead className="text-right">Securities</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">WHT</TableHead>
                      {showZakat && <TableHead className="text-right">Zakat</TableHead>}
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {received.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Link href={`/stock/${r.symbol}`} className="font-medium hover:text-primary">
                              {r.symbol}
                            </Link>
                            {r.companyName && (
                              <span className="text-[11px] text-muted-foreground leading-tight max-w-[160px] truncate">
                                {r.companyName}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(r.creditedOn)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPKR(r.perShare)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.quantityHeld, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPKR(r.grossAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums text-loss">{formatPKR(r.whtAmount)}</TableCell>
                        {showZakat && (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {r.zakatAmount > 0 ? formatPKR(r.zakatAmount) : "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right tabular-nums font-semibold text-gain">
                          {formatPKR(r.netAmount)}
                        </TableCell>
                        <TableCell className="w-8 text-center">
                          {r.id && (
                            <DeleteDividendButton
                              record={r}
                              deleting={deletingId === r.id}
                              onConfirm={() => handleDelete(r.id!)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Upcoming book closures
          </h3>
          {hasUpcoming ? (
            <div className="overflow-x-auto rounded-xl border border-border scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Symbol</TableHead>
                    <TableHead className="hidden sm:table-cell">Company</TableHead>
                    <TableHead>Closure from</TableHead>
                    <TableHead>Closure to</TableHead>
                    <TableHead>Announced payout</TableHead>
                    <TableHead className="text-right">Held qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Link href={`/stock/${u.symbol}`} className="font-medium hover:text-primary">
                          {u.symbol}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{u.company}</TableCell>
                      <TableCell className="text-muted-foreground">{u.bookClosureFrom}</TableCell>
                      <TableCell className="text-muted-foreground">{u.bookClosureTo}</TableCell>
                      <TableCell className="font-medium">{u.payout}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(u.currentQty, 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No upcoming dividend announcements for your held stocks.</p>
              <p className="mt-1 text-xs text-muted-foreground">Book closures will appear here once companies announce their next dividend.</p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Tax figures sourced from official CDC reports.{" "}
          <Link href="/account" className="underline underline-offset-2 hover:text-foreground">
            Update tax settings
          </Link>
        </p>
      </div>
    </>
  );
}

function DeleteDividendButton({
  record,
  deleting,
  onConfirm,
}: {
  record: ReceivedDividend;
  deleting: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={deleting}
          className="text-muted-foreground hover:text-loss disabled:opacity-40 transition-colors"
          title="Delete dividend"
        >
          <Trash2 className="size-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete dividend record?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the{" "}
            <span className="font-medium text-foreground">{record.symbol}</span> dividend of{" "}
            <span className="font-medium text-foreground">{formatPKR(record.netAmount)}</span> paid on{" "}
            <span className="font-medium text-foreground">{formatDate(record.creditedOn)}</span>.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-loss text-white hover:bg-loss/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
