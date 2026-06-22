"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/sparkline";
import { ChangeBadge } from "@/components/change-badge";
import { DataDelayBadge } from "@/components/status-badges";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, plColorClass } from "@/lib/format";
import type { IndexData, SectorStat, MarketBreadth } from "@/lib/services/market";

const RETURN_LABELS: { key: keyof IndexData["returns"]; label: string }[] = [
  { key: "d1", label: "1D" },
  { key: "w1", label: "1W" },
  { key: "m1", label: "1M" },
  { key: "m3", label: "3M" },
  { key: "y1", label: "1Y" },
  { key: "ytd", label: "YTD" },
];

export function IndicesPanel({
  indices,
  sectors,
  breadth,
}: {
  indices: IndexData[];
  sectors: SectorStat[];
  breadth: MarketBreadth;
}) {
  const [selected, setSelected] = React.useState(
    indices.find((i) => i.symbol === "KSE100")?.symbol ?? indices[0]?.symbol
  );
  const active = indices.find((i) => i.symbol === selected) ?? indices[0];

  return (
    <div className="space-y-4">
      {/* Index cards */}
      <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1">
        {indices.map((idx) => {
          const isActive = idx.symbol === selected;
          return (
            <button
              key={idx.symbol}
              onClick={() => setSelected(idx.symbol)}
              className={cn(
                "flex min-w-52 shrink-0 items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
                isActive ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/40"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{idx.symbol}</p>
                <p className="tabular-nums text-lg font-semibold">{formatNumber(idx.value, 0)}</p>
                <ChangeBadge pct={idx.changePct} className="text-xs" />
              </div>
              <Sparkline data={idx.spark} className="shrink-0" />
            </button>
          );
        })}
      </div>

      {active && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Selected index detail */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Activity className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-xl">{active.symbol}</CardTitle>
                  <p className="text-sm text-muted-foreground">{active.name}</p>
                </div>
              </div>
              <DataDelayBadge />
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-3xl font-bold tabular-nums">{formatNumber(active.value, 2)}</span>
                <span className={cn("pb-1 text-sm font-medium tabular-nums", plColorClass(active.change))}>
                  {active.change >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(active.change), 2)} ({formatPercent(active.changePct)})
                </span>
              </div>

              {/* Returns chips */}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {RETURN_LABELS.map(({ key, label }) => {
                  const v = active.returns[key];
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-lg border border-border px-2 py-2 text-center",
                        v > 0 ? "bg-gain/5" : v < 0 ? "bg-loss/5" : ""
                      )}
                    >
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className={cn("text-sm font-semibold tabular-nums", plColorClass(v))}>
                        {formatPercent(v)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <Stat label="Day High" value={formatNumber(active.dayHigh, 0)} />
                <Stat label="Day Low" value={formatNumber(active.dayLow, 0)} />
                <Stat label="52W High" value={formatNumber(active.week52High, 0)} />
                <Stat label="52W Low" value={formatNumber(active.week52Low, 0)} />
              </div>
            </CardContent>
          </Card>

          {/* Sector breakdown (by name) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sectors</CardTitle>
              <BreadthBar breadth={breadth} />
            </CardHeader>
            <CardContent className="max-h-[22rem] space-y-2.5 overflow-y-auto scrollbar-thin">
              {sectors.map((s) => (
                <div key={s.sector}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{s.sector}</span>
                    <span className={cn("shrink-0 tabular-nums", plColorClass(s.avgChangePct))}>
                      {formatPercent(s.avgChangePct)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", s.avgChangePct >= 0 ? "bg-gain" : "bg-loss")}
                      style={{ width: `${Math.max(6, s.weight * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function BreadthBar({ breadth }: { breadth: MarketBreadth }) {
  const total = Math.max(1, breadth.advances + breadth.declines + breadth.unchanged);
  return (
    <div className="space-y-1">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-gain" style={{ width: `${(breadth.advances / total) * 100}%` }} />
        <div className="bg-muted-foreground/30" style={{ width: `${(breadth.unchanged / total) * 100}%` }} />
        <div className="bg-loss" style={{ width: `${(breadth.declines / total) * 100}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span className="text-gain">{breadth.advances} up</span>
        <span className="text-loss">{breadth.declines} down</span>
      </div>
    </div>
  );
}
