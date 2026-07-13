"use client";

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { amcIconUrl, identifyAmcBrand } from "@/lib/amc-brands";
import { formatPKR, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FundsBreakdownData, BreakdownFund, BreakdownHolding } from "@/lib/services/funds-breakdown";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function FundsBreakdownBoard({ data }: { data: FundsBreakdownData }) {
  const periodLabel =
    data.periodYear && data.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  // Unique AMCs for filter pills
  const amcs = React.useMemo(() => {
    const seen = new Map<string, string>(); // amc canonical → displayName
    for (const f of data.funds) {
      if (!seen.has(f.amc)) seen.set(f.amc, f.amc);
    }
    return Array.from(seen.keys()).sort((a, b) => a.localeCompare(b));
  }, [data.funds]);

  const [selectedAmc, setSelectedAmc] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [classFilter, setClassFilter] = React.useState<"all" | "islamic" | "conventional">("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.funds.filter((f) => {
      if (selectedAmc && f.amc !== selectedAmc) return false;
      if (classFilter !== "all" && f.classFilter !== classFilter) return false;
      if (q && !f.fundName.toLowerCase().includes(q) && !f.amc.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data.funds, selectedAmc, query, classFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        {/* Search + class toggle row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search funds…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            {(["all", "islamic", "conventional"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setClassFilter(v)}
                className={cn(
                  "px-3 py-1.5 font-medium capitalize transition-colors",
                  classFilter === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted/50"
                )}
              >
                {v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* AMC pills */}
        <div className="flex flex-wrap gap-1.5">
          <AmcPill
            label="All AMCs"
            active={selectedAmc === null}
            onClick={() => setSelectedAmc(null)}
          />
          {amcs.map((amc) => {
            const brand = identifyAmcBrand(amc);
            return (
              <AmcPill
                key={amc}
                label={displayAmcShort(brand.shortName || amc)}
                active={selectedAmc === amc}
                color={selectedAmc === amc ? brand.color : undefined}
                onClick={() => setSelectedAmc(selectedAmc === amc ? null : amc)}
              />
            );
          })}
        </div>

        {periodLabel && (
          <p className="text-xs text-muted-foreground/60">
            Based on{" "}
            <span className="font-medium text-muted-foreground">{periodLabel}</span>{" "}
            published holdings · live PSX prices · Rs 100k invested
          </p>
        )}
      </div>

      {/* Fund count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} fund{filtered.length !== 1 ? "s" : ""}
        {selectedAmc || classFilter !== "all" || query ? " (filtered)" : ""}
      </p>

      {/* Fund cards grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No funds match the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((fund) => (
            <FundCard key={`${fund.amc}||${fund.fundName}`} fund={fund} />
          ))}
        </div>
      )}
    </div>
  );
}

function AmcPill({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      style={active && color ? { backgroundColor: color, borderColor: color } : undefined}
    >
      {label}
    </button>
  );
}

function FundCard({ fund }: { fund: BreakdownFund }) {
  const brand = identifyAmcBrand(fund.amc);
  const iconUrl = fund.amcLogoUrl ?? amcIconUrl(brand);
  const [imgFailed, setImgFailed] = React.useState(false);

  const hasUnknown = fund.unknownWeight > 0;
  const coveragePct = fund.knownWeight > 0
    ? Math.round((fund.pricedWeight / fund.knownWeight) * 100)
    : 0;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border-2 bg-card"
      style={{ borderColor: `${brand.color}28` }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-2.5 px-3 py-2.5"
        style={{
          background: `linear-gradient(135deg, ${brand.color}10 0%, ${brand.color}04 100%)`,
          borderBottom: `1px solid ${brand.color}1a`,
        }}
      >
        <div
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border"
          style={{ borderColor: `${brand.color}40`, backgroundColor: `${brand.color}18` }}
        >
          {iconUrl && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iconUrl}
              alt={brand.shortName}
              className="h-full w-full object-contain p-0.5"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="text-[8px] font-bold leading-none" style={{ color: brand.color }}>
              {brand.initials}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1 mb-0.5">
            {fund.classFilter === "islamic" && (
              <TypeBadge label="Islamic" color="emerald" />
            )}
            {fund.classFilter === "conventional" && (
              <TypeBadge label="Conv." color="blue" />
            )}
          </div>
          {fund.fundId ? (
            <Link
              href={`/market/mutual-funds/${fund.fundId}`}
              className="block text-sm font-bold leading-tight hover:underline"
              style={{ color: brand.color }}
            >
              {fund.fundName}
            </Link>
          ) : (
            <p className="text-sm font-bold leading-tight" style={{ color: brand.color }}>
              {fund.fundName}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fund.amcShort}
            {fund.equityPct != null && (
              <span className="ml-1.5 text-muted-foreground/70">
                · Equity {fund.equityPct.toFixed(1)}%
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Holdings table */}
      <div className="flex-1 divide-y divide-border/20">
        {/* Column headers */}
        <div
          className="grid px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60"
          style={{ gridTemplateColumns: "1fr 3.5rem 5rem" }}
        >
          <span>Stock</span>
          <span className="text-right">WT%</span>
          <span className="text-right">P/L</span>
        </div>

        {/* Holding rows */}
        {fund.holdings.map((h, i) => (
          <HoldingRow key={h.symbol ?? h.stockName ?? i} holding={h} />
        ))}
      </div>

      {/* Footer */}
      <div
        className="space-y-1.5 border-t border-border/30 px-3 py-2"
        style={{ background: `${brand.color}06` }}
      >
        {hasUnknown && (
          <p className="text-[10px] text-muted-foreground/60">
            Unknown holdings: {fund.unknownWeight.toFixed(1)}%
            {fund.unknownEstimate != null && (
              <span className={cn("ml-1 font-semibold", plColorClass(fund.unknownEstimate))}>
                (approx. {formatPKR(fund.unknownEstimate, { sign: true })})
              </span>
            )}
          </p>
        )}
        {coveragePct < 100 && fund.knownWeight > 0 && (
          <p className="text-[10px] text-muted-foreground/50">
            {coveragePct}% of holdings priced
          </p>
        )}
        {fund.totalEstimate != null && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              Total Estimate
            </span>
            <span className={cn("text-sm font-bold tabular-nums", plColorClass(fund.totalEstimate))}>
              {formatPKR(fund.totalEstimate, { sign: true })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function HoldingRow({ holding: h }: { holding: BreakdownHolding }) {
  const isOther = h.stockName === "Other Holdings" || !h.symbol;
  if (isOther) return null; // skip "Other Holdings" row in the table

  return (
    <div
      className={cn(
        "grid items-center px-3 py-1 text-xs",
        h.plAmount != null && h.plAmount > 0 && "bg-emerald-50/40 dark:bg-emerald-950/10",
        h.plAmount != null && h.plAmount < 0 && "bg-red-50/40 dark:bg-red-950/10",
      )}
      style={{ gridTemplateColumns: "1fr 3.5rem 5rem" }}
    >
      <span className="min-w-0 truncate text-foreground/80">{h.stockName}</span>
      <span className="text-right tabular-nums text-muted-foreground">{h.percentage.toFixed(1)}%</span>
      <span className={cn("text-right font-semibold tabular-nums", plColorClass(h.plAmount))}>
        {h.plAmount != null ? formatPKR(h.plAmount, { sign: true, decimals: 0 }) : "—"}
      </span>
    </div>
  );
}

function TypeBadge({ label, color }: { label: string; color: "emerald" | "blue" | "violet" }) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  }[color];
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

function displayAmcShort(name: string) {
  // Keep it short for filter pills
  return name.length > 14 ? name.slice(0, 13) + "…" : name;
}
