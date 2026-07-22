"use client";

import * as React from "react";
import { Flame, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/ui/accent";
import { StatCard } from "@/components/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { plColorClass } from "@/lib/format";
import { usePersistentResource } from "@/lib/hooks/use-persistent-resource";
import { PriceLineChart } from "@/components/charts/price-line-chart";
import type { PakistanFuelData } from "@/lib/services/pakistan-fuel-prices";

const DURATIONS = [
  { label: "1M",  days: 30   },
  { label: "3M",  days: 90   },
  { label: "6M",  days: 180  },
  { label: "1Y",  days: 365  },
  { label: "2Y",  days: 730  },
  { label: "All", days: Infinity },
] as const;

type DurationLabel = (typeof DURATIONS)[number]["label"];

const CARD_FUELS = ["Petrol", "High Speed Diesel", "LPG", "Kerosene"];

export interface PakFuelBoardHandle {
  refresh(): Promise<void>;
}

export const PakistanFuelPricesBoard = React.forwardRef<PakFuelBoardHandle>(
  function PakistanFuelPricesBoard(_, ref) {
    const [duration, setDuration] = React.useState<DurationLabel>("1Y");

    const { data: fuelData, isLoading, refreshNow } = usePersistentResource<PakistanFuelData>({
      cacheKey: "public:pk-fuel-prices-v1",
      url: "/api/public/pakistan-fuel-prices",
      refreshInterval: 6 * 60 * 60 * 1000,
    });

    React.useImperativeHandle(ref, () => ({
      refresh: () => refreshNow(),
    }), [refreshNow]);

    const statFuels = React.useMemo(() => {
      if (!fuelData) return [];
      return CARD_FUELS.map((keyword) =>
        fuelData.current.find((f) =>
          f.label.toLowerCase().includes(keyword.toLowerCase().split(" ")[0])
        )
      ).filter((f): f is NonNullable<typeof f> => f != null && (f.newPrice ?? 0) > 0);
    }, [fuelData]);

    const filteredHistory = React.useMemo(() => {
      if (!fuelData?.history) return [];
      const days = DURATIONS.find((d) => d.label === duration)?.days ?? Infinity;
      if (!Number.isFinite(days)) return fuelData.history;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days as number));
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      return fuelData.history.filter((e) => e.date >= cutoffStr);
    }, [fuelData?.history, duration]);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {isLoading && !fuelData
            ? CARD_FUELS.map((k) => (
                <div key={k} className="h-24 animate-pulse rounded-xl bg-muted" />
              ))
            : statFuels.map((fuel) => {
                const change = fuel.signedChange ?? 0;
                return (
                  <StatCard
                    key={fuel.label}
                    label={fuel.label}
                    value={fuel.newPrice != null ? `Rs ${fuel.newPrice.toFixed(2)}` : "—"}
                    tone={change > 0 ? "gain" : change < 0 ? "loss" : "default"}
                    accent="orange"
                    icon={
                      change >= 0 ? (
                        <TrendingUp className="size-4" />
                      ) : (
                        <TrendingDown className="size-4" />
                      )
                    }
                    sub={
                      change !== 0 ? (
                        <span className={cn("text-xs font-medium", change > 0 ? "text-emerald-500" : "text-rose-500")}>
                          {change > 0 ? "+" : ""}{change.toFixed(2)} from last revision
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No change</span>
                      )
                    }
                  />
                );
              })}
        </div>

        {filteredHistory.length > 1 && (
          <div className="rounded-xl border border-border bg-muted/10 p-3">
            <PriceLineChart
              data={[...filteredHistory].reverse()}
              color="hsl(25 95% 53%)"
              height={160}
              unit="Rs "
              label="Petrol (Super) — Rs/L"
            />
          </div>
        )}

        <Card>
          <CardHeader className="gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <IconChip accent="orange" variant="gradient">
                  <Flame />
                </IconChip>
                <div>
                  <CardTitle>Petrol (Super) Price History</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fuelData?.effectiveDate
                      ? `Current revision: ${fuelData.effectiveDate}`
                      : "Pakistan petroleum price history — OGRA"}
                  </p>
                </div>
              </div>
              <a
                href="https://www.pakwheels.com/petroleum-prices-in-pakistan"
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-sm font-medium text-primary hover:underline"
              >
                Source
              </a>
            </div>

            <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
              {DURATIONS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => setDuration(d.label)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
                    duration === d.label
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="px-0 pb-2">
            <div className="max-h-[460px] overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead className="text-right">Price (Rs/L)</TableHead>
                    <TableHead className="pr-6 text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && !fuelData
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={3}>
                            <div className="h-4 animate-pulse rounded bg-muted" />
                          </TableCell>
                        </TableRow>
                      ))
                    : filteredHistory.map((entry, i) => {
                        const prev = filteredHistory[i + 1];
                        const change = prev != null ? entry.price - prev.price : null;
                        return (
                          <TableRow key={entry.date}>
                            <TableCell className="pl-6 text-sm">{fmtDate(entry.date)}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums">
                              {entry.price.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "pr-6 text-right tabular-nums text-sm",
                                change == null
                                  ? "text-muted-foreground"
                                  : plColorClass(-change)
                              )}
                            >
                              {change == null
                                ? "—"
                                : `${change > 0 ? "+" : ""}${change.toFixed(2)}`}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  {!isLoading && filteredHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-20 text-center text-sm text-muted-foreground">
                        No data for the selected period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
);

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
