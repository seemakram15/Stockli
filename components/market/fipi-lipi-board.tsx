"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFlow, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  FLOW_SECTORS,
  SECTOR_GLOSSARY,
  type CategoryRow,
  type FipiLipiData,
} from "@/lib/types/fipi-lipi";

export type FlowCurrency = "USD" | "PKR";

export function FipiLipiBoard({
  data,
  currency,
  onCurrencyChange,
}: {
  data: FipiLipiData;
  currency: FlowCurrency;
  onCurrencyChange: (currency: FlowCurrency) => void;
}) {
  const [selected, setSelected] = React.useState(data.latest?.date ?? "");
  React.useEffect(() => setSelected(data.latest?.date ?? ""), [data.latest?.date]);

  const day = React.useMemo(
    () => data.days.find((d) => d.date === selected) ?? data.latest,
    [data.days, selected, data.latest]
  );

  const index = data.dates.indexOf(selected);
  const step = (delta: number) => {
    const next = data.dates[index + delta];
    if (next) setSelected(next);
  };

  /** Snap a free-typed date to the nearest trading day at or before it. */
  const pickDate = (value: string) => {
    if (data.dates.includes(value)) {
      setSelected(value);
      return;
    }
    const before = [...data.dates].reverse().find((d) => d <= value);
    setSelected(before ?? data.dates[0]);
  };

  if (!day) return null;

  const rate = data.usdPkrRate;
  const fmt = (usd: number) =>
    formatFlow(currency === "PKR" ? usd * rate : usd, currency, { showUnit: false });

  return (
    <div className="space-y-3">
      {/* Date picker + currency */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={index <= 0}
          onClick={() => step(-1)}
          aria-label="Previous trading day"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <input
          type="date"
          value={selected}
          min={data.dates[0]}
          max={data.dates[data.dates.length - 1]}
          onChange={(e) => pickDate(e.target.value)}
          aria-label="Trading date"
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          disabled={index < 0 || index >= data.dates.length - 1}
          onClick={() => step(1)}
          aria-label="Next trading day"
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-1 hidden text-sm text-muted-foreground sm:inline">
          {longDate(day.date)}
        </span>

        <div className="ml-auto inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
          {(["USD", "PKR"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onCurrencyChange(c)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                currency === c
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[64rem] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <Th className="sticky left-0 z-10 min-w-[9.5rem] bg-muted/40 text-left">
                  Investor
                </Th>
                <Th>Buy</Th>
                <Th>Sell</Th>
                <Th className="border-x-2 border-primary/30 bg-primary/10 text-foreground">
                  Net
                </Th>
                {FLOW_SECTORS.map((s) => (
                  <Th key={s}>{s}</Th>
                ))}
                <Th className="bg-muted/60">{data.fyLabel}</Th>
                <Th className="bg-muted/60">{data.cyLabel}</Th>
              </tr>
            </thead>

            <GroupBody
              title="FIPI"
              subtitle="Foreign investors — sector-wise"
              color="var(--color-sky-500, #0ea5e9)"
              rows={[]}
              total={{ ...day.fipiNet, label: "FIPI (All Foreign)" }}
              fmt={fmt}
            />
            <GroupBody
              title="LIPI"
              subtitle="Local investors"
              color="var(--color-violet-500, #8b5cf6)"
              rows={day.lipi}
              total={day.lipiNet}
              fmt={fmt}
            />
          </table>
        </div>
      </div>

      <ForeignBreakdown rows={day.fipi} total={day.fipiNet} fmt={fmt} fyLabel={data.fyLabel} cyLabel={data.cyLabel} />

      <SectorGlossary />
    </div>
  );
}

function GroupBody({
  title,
  subtitle,
  color,
  rows,
  total,
  fmt,
}: {
  title: string;
  subtitle: string;
  color: string;
  rows: CategoryRow[];
  total: CategoryRow;
  fmt: (usd: number) => string;
}) {
  const span = 4 + FLOW_SECTORS.length + 2;
  return (
    <tbody className="border-b border-border last:border-b-0">
      <tr>
        <td colSpan={span} className="px-3 py-1.5" style={{ background: `${color}12` }}>
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
            {title}
          </span>
          <span className="ml-2 text-[11px] text-muted-foreground">{subtitle}</span>
        </td>
      </tr>

      {rows.map((row) => (
        <Row key={row.label} row={row} fmt={fmt} accent={color} />
      ))}
      <Row row={total} fmt={fmt} accent={color} isTotal />
    </tbody>
  );
}

function Row({
  row,
  fmt,
  accent,
  isTotal = false,
}: {
  row: CategoryRow;
  fmt: (usd: number) => string;
  accent: string;
  isTotal?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-t border-border/40",
        isTotal ? "bg-muted/40 font-bold" : "hover:bg-muted/20"
      )}
    >
      <td
        className={cn(
          "sticky left-0 z-10 min-w-[9.5rem] px-3 py-1.5 text-left",
          isTotal ? "bg-muted/60 font-bold" : "bg-card"
        )}
        style={isTotal ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
      >
        {row.label}
      </td>
      {/* Buy/Sell are gross turnover, not P/L — keep them muted so Net reads first. */}
      <Num value={row.buy} fmt={fmt} muted />
      <Num value={-row.sell} fmt={fmt} muted />
      <Num
        value={row.net}
        fmt={fmt}
        className="border-x-2 border-primary/30 bg-primary/10 text-sm font-bold"
      />
      {row.sectors.map((v, i) => (
        <Num key={FLOW_SECTORS[i]} value={v} fmt={fmt} />
      ))}
      <Num value={row.fytd} fmt={fmt} className="bg-muted/40" />
      <Num value={row.cytd} fmt={fmt} className="bg-muted/40" />
    </tr>
  );
}

function Num({
  value,
  fmt,
  className,
  muted = false,
}: {
  value: number;
  fmt: (usd: number) => string;
  className?: string;
  muted?: boolean;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-2 py-1.5 text-right tabular-nums",
        muted ? "text-muted-foreground" : plColorClass(value),
        className
      )}
    >
      {fmt(value)}
    </td>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}

function ForeignBreakdown({
  rows,
  total,
  fmt,
  fyLabel,
  cyLabel,
}: {
  rows: CategoryRow[];
  total: CategoryRow;
  fmt: (usd: number) => string;
  fyLabel: string;
  cyLabel: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="px-3 py-2" style={{ background: "color-mix(in srgb, var(--color-sky-500, #0ea5e9) 7%, transparent)" }}>
        <span className="text-[11px] font-bold uppercase tracking-wide text-sky-500">Foreign Investor Breakdown</span>
        <span className="ml-2 text-[11px] text-muted-foreground">
          FIPI split by investor type — NCCPL publishes this without sector detail
        </span>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[32rem] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <Th className="min-w-[9.5rem] text-left">Investor</Th>
              <Th>Buy</Th>
              <Th>Sell</Th>
              <Th className="border-x-2 border-primary/30 bg-primary/10 text-foreground">Net</Th>
              <Th className="bg-muted/60">{fyLabel}</Th>
              <Th className="bg-muted/60">{cyLabel}</Th>
            </tr>
          </thead>
          <tbody>
            {[...rows, total].map((row, i) => {
              const isTotal = i === rows.length;
              return (
                <tr key={row.label} className={cn("border-t border-border/40", isTotal ? "bg-muted/40 font-bold" : "hover:bg-muted/20")}>
                  <td className="px-3 py-1.5 text-left">{isTotal ? "FIPI (All Foreign)" : row.label}</td>
                  <Num value={row.buy} fmt={fmt} muted />
                  <Num value={-row.sell} fmt={fmt} muted />
                  <Num value={row.net} fmt={fmt} className="border-x-2 border-primary/30 bg-primary/10 text-sm font-bold" />
                  <Num value={row.fytd} fmt={fmt} className="bg-muted/40" />
                  <Num value={row.cytd} fmt={fmt} className="bg-muted/40" />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectorGlossary() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-3 text-sm font-semibold">What each sector means</p>
      <dl className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
        {SECTOR_GLOSSARY.map((item) => (
          <div key={item.term} className="flex gap-2 text-xs">
            <dt className="w-20 shrink-0 font-semibold text-foreground/90">{item.term}</dt>
            <dd className="min-w-0 flex-1 text-muted-foreground">{item.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
