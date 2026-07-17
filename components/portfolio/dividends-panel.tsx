import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPKR, formatDate, formatNumber } from "@/lib/format";
import type { DividendIncomeSummary, TaxSettings } from "@/lib/types";

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "cyan" | "gold";
}) {
  const border = {
    green: "border-t-gain",
    red: "border-t-loss",
    cyan: "border-t-cyan-500",
    gold: "border-t-amber-500",
    undefined: "border-t-border",
  }[accent ?? "undefined"];

  return (
    <div className={`rounded-xl border border-border border-t-2 bg-card px-4 py-3 ${border}`}>
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function DividendsPanel({
  dividendIncome,
  taxSettings,
}: {
  dividendIncome: DividendIncomeSummary;
  taxSettings: TaxSettings;
}) {
  const { received, upcoming, totalGross, totalWHT, totalZakat, totalNet } = dividendIncome;
  const hasReceived = received.length > 0;
  const hasUpcoming = upcoming.length > 0;

  if (!hasReceived && !hasUpcoming) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No dividend history found for your holdings yet.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Dividends appear here once PSX records a payout for stocks you have held.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {hasReceived && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total gross" value={formatPKR(totalGross)} accent="green" />
          <SummaryCard label="WHT deducted" value={formatPKR(totalWHT)} accent="red" />
          <SummaryCard label="Zakat" value={formatPKR(totalZakat)} accent="cyan" />
          <SummaryCard label="Net received" value={formatPKR(totalNet)} accent="gold" />
        </div>
      )}

      {hasReceived && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Received dividends
          </h3>

          <div className="space-y-3 sm:hidden">
            {received.map((r, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-primary">
                    {r.symbol}
                  </Link>
                  <span className="text-xs text-muted-foreground">{formatDate(r.creditedOn)}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Per share</p>
                    <p className="tabular-nums font-medium">{formatPKR(r.perShare)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Qty held</p>
                    <p className="tabular-nums font-medium">{formatNumber(r.quantityHeld, 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gross</p>
                    <p className="tabular-nums font-medium">{formatPKR(r.grossAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">WHT</p>
                    <p className="tabular-nums font-medium text-loss">{formatPKR(r.whtAmount)}</p>
                  </div>
                  {r.zakatAmount > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Zakat</p>
                      <p className="tabular-nums font-medium text-muted-foreground">{formatPKR(r.zakatAmount)}</p>
                    </div>
                  )}
                  <div className={r.zakatAmount > 0 ? "text-right" : "col-span-2 text-right"}>
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className="tabular-nums font-semibold text-gain">{formatPKR(r.netAmount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto scrollbar-thin sm:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Symbol</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Per Share</TableHead>
                  <TableHead className="text-right">Qty Held</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">WHT</TableHead>
                  {totalZakat > 0 && <TableHead className="text-right">Zakat</TableHead>}
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {received.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Link href={`/stock/${r.symbol}`} className="font-medium hover:text-primary">
                        {r.symbol}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.creditedOn)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPKR(r.perShare)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.quantityHeld, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPKR(r.grossAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-loss">{formatPKR(r.whtAmount)}</TableCell>
                    {totalZakat > 0 && (
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.zakatAmount > 0 ? formatPKR(r.zakatAmount) : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums font-medium text-gain">
                      {formatPKR(r.netAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {hasUpcoming && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Upcoming book closures (held stocks)
          </h3>
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
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        WHT {taxSettings.taxFiler ? "15%" : "30%"} ({taxSettings.taxFiler ? "filer" : "non-filer"})
        {taxSettings.zakatOnDividends ? " · Zakat 2.5% enabled" : ""}.{" "}
        <Link href="/account" className="underline underline-offset-2 hover:text-foreground">
          Update tax settings
        </Link>
      </p>
    </div>
  );
}
