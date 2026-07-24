"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import { loadPublishedPeriods, loadPublishedFundHoldings } from "@/lib/actions/fund-holdings";
import type { FundHolding } from "@/lib/types/fund-holdings";
import { IconChip } from "@/components/ui/accent";
import { StockIdentity } from "@/components/stock/stock-identity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  fundName: string;
}

export function FundHoldingsSection({ fundName }: Props) {
  const [periods, setPeriods] = React.useState<{ year: number; month: number }[]>([]);
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("");
  const [holdings, setHoldings] = React.useState<FundHolding[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPublishedPeriods(fundName).then(({ periods: p }) => {
      if (cancelled) return;
      setPeriods(p);
      if (p.length > 0) {
        const first = p[0];
        const key = `${first.year}-${first.month}`;
        setSelectedPeriod(key);
        void fetchHoldings(first.year, first.month);
      } else {
        setHoldings([]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when fund changes
  }, [fundName]);

  async function fetchHoldings(year: number, month: number) {
    setLoading(true);
    const { holdings: h } = await loadPublishedFundHoldings(fundName, year, month);
    setHoldings(h);
    setLoading(false);
  }

  function handlePeriodChange(val: string) {
    setSelectedPeriod(val);
    const [year, month] = val.split("-").map(Number);
    void fetchHoldings(year, month);
  }

  const OTHER_NAME = "Other Holdings";
  const regularHoldings = holdings.filter((h) => h.stockName !== OTHER_NAME);
  const otherRow = holdings.find((h) => h.stockName === OTHER_NAME);
  const total = regularHoldings.reduce((s, h) => s + h.percentage, 0);
  const grandTotal = total + (otherRow?.percentage ?? 0);

  return (
    <Card className="overflow-hidden rounded-3xl shadow-soft ring-1 ring-foreground/10">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-sky-500/10 via-transparent to-transparent">
        <div className="flex items-center gap-3">
          <IconChip accent="sky" variant="gradient">
            <BarChart3 />
          </IconChip>
          <div>
            <CardTitle className="font-bold">Fund holdings</CardTitle>
            <p className="text-xs text-muted-foreground">Published portfolio weights</p>
          </div>
        </div>
        {periods.length > 1 && (
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {periods.map((p) => (
                <SelectItem key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                  {MONTHS[p.month - 1]} {p.year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {periods.length === 1 && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {MONTHS[periods[0].month - 1]} {periods[0].year}
          </span>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-xl" />
            ))}
          </div>
        ) : periods.length === 0 || holdings.length === 0 ? (
          <p className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Holdings are not available for this fund yet. When published, top stock weights will
            appear here.
          </p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 sm:hidden">
              {regularHoldings.map((h, i) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/80 bg-muted/15 px-3 py-2.5"
                >
                  <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    {h.symbol ? (
                      <StockIdentity
                        href={`/stock/${h.symbol}`}
                        symbol={h.symbol}
                        name={h.stockName}
                        size="xs"
                      />
                    ) : (
                      <p className="truncate text-sm font-medium">{h.stockName}</p>
                    )}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-500/70"
                        style={{
                          width: `${Math.min(100, (h.percentage / Math.max(grandTotal, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {h.percentage.toFixed(2)}%
                  </span>
                </div>
              ))}
              {otherRow && (
                <div className="flex items-center justify-between rounded-2xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                  <span>Other holdings</span>
                  <span className="font-mono tabular-nums">{otherRow.percentage.toFixed(2)}%</span>
                </div>
              )}
              <p className="px-1 pt-1 text-xs text-muted-foreground">
                {regularHoldings.length} stocks · total {grandTotal.toFixed(2)}%
              </p>
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="w-8 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      #
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Holding
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">
                      % of NAV
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {regularHoldings.map((h, i) => (
                    <tr key={h.id} className="transition-colors hover:bg-muted/20">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        {h.symbol ? (
                          <StockIdentity
                            href={`/stock/${h.symbol}`}
                            symbol={h.symbol}
                            name={h.stockName}
                            size="sm"
                          />
                        ) : (
                          <span className="font-medium">{h.stockName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted md:block">
                            <div
                              className="h-full rounded-full bg-sky-500/70"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (h.percentage / Math.max(grandTotal, 1)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="w-14 text-right font-mono text-sm font-semibold tabular-nums">
                            {h.percentage.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {otherRow && (
                    <tr className="bg-muted/10">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                      <td className="px-3 py-2.5 italic text-muted-foreground">Other holdings</td>
                      <td className="px-3 py-2.5 text-right font-mono text-sm tabular-nums text-muted-foreground">
                        {otherRow.percentage.toFixed(2)}%
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={2} className="px-3 py-2.5 text-xs text-muted-foreground">
                      {regularHoldings.length} stocks
                      {otherRow ? " + other holdings" : ""}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm font-bold tabular-nums">
                      {grandTotal.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
