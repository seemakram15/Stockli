"use client";

import * as React from "react";
import { BarChart3, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadPublishedPeriods, loadPublishedFundHoldings } from "@/lib/actions/fund-holdings";
import type { FundHolding } from "@/lib/types/fund-holdings";
import { IconChip } from "@/components/ui/accent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface Props {
  fundName: string;
}

export function FundHoldingsSection({ fundName }: Props) {
  const [periods, setPeriods] = React.useState<{ year: number; month: number }[]>([]);
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("");
  const [holdings, setHoldings] = React.useState<FundHolding[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadPublishedPeriods(fundName).then(({ periods: p }) => {
      setPeriods(p);
      if (p.length > 0) {
        const first = p[0];
        const key = `${first.year}-${first.month}`;
        setSelectedPeriod(key);
        fetchHoldings(first.year, first.month);
      } else {
        setLoading(false);
      }
    });
  }, [fundName]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchHoldings(year: number, month: number) {
    setLoading(true);
    const { holdings: h } = await loadPublishedFundHoldings(fundName, year, month);
    setHoldings(h);
    setLoading(false);
  }

  function handlePeriodChange(val: string) {
    setSelectedPeriod(val);
    const [year, month] = val.split("-").map(Number);
    fetchHoldings(year, month);
  }

  if (!loading && periods.length === 0) return null;

  const total = holdings.reduce((s, h) => s + h.percentage, 0);
  const others = Math.max(0, 100 - total);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconChip accent="sky" variant="gradient"><BarChart3 /></IconChip>
          <CardTitle>Stock Holdings</CardTitle>
        </div>
        {periods.length > 1 && (
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-8 w-32 text-xs">
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
          <span className="text-xs text-muted-foreground">
            {MONTHS[periods[0].month - 1]} {periods[0].year}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : holdings.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            No holdings data for this period.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Ticker</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">% of NAV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holdings.map((h, i) => (
                  <tr key={h.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      {h.symbol ? (
                        <span className="font-mono text-xs font-semibold text-primary">{h.symbol}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-foreground/80">{h.stockName}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${Math.min(100, (h.percentage / Math.max(total, 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-sm tabular-nums w-14 text-right">
                          {h.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30">
                  <td colSpan={3} className="px-3 py-2 text-xs text-muted-foreground">
                    {holdings.length} stocks disclosed
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm font-semibold tabular-nums">
                    {total.toFixed(2)}%
                  </td>
                </tr>
                {others > 0.5 && (
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
      </CardContent>
    </Card>
  );
}
