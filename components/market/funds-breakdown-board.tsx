"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, Search, X } from "lucide-react";
import { amcIconUrl, identifyAmcBrand } from "@/lib/amc-brands";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import {
  FundIslamicIcon,
  IslamicMark,
  isIslamicOrShariahName,
  isShariahSymbol,
  useShariahSymbols,
} from "@/components/market/islamic-mark";
import { formatPKR, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FundsBreakdownData, BreakdownFund, BreakdownHolding } from "@/lib/services/funds-breakdown";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CLASS_FILTERS = [
  { value: "all" as const, label: "All" },
  { value: "islamic" as const, label: "Islamic" },
  { value: "conventional" as const, label: "Conventional" },
];

export function FundsBreakdownBoard({ data }: { data: FundsBreakdownData }) {
  const periodLabel =
    data.periodYear && data.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  const amcOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    const logos = new Map<string, string>();
    for (const fund of data.funds) {
      counts.set(fund.amc, (counts.get(fund.amc) ?? 0) + 1);
      if (fund.amcLogoUrl && !logos.has(fund.amc)) logos.set(fund.amc, fund.amcLogoUrl);
    }
    return Array.from(counts.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((amc) => {
        const brand = identifyAmcBrand(amc);
        return {
          value: amc,
          brand,
          count: counts.get(amc) ?? 0,
          logoUrl: logos.get(amc) ?? brand.logoUrl,
        };
      });
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

  const hasActiveFilters = Boolean(selectedAmc || classFilter !== "all" || query);
  const shariahSymbols = useShariahSymbols();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/30 shadow-sm">
        <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
          {/* Search + class toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search funds…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div
              role="group"
              aria-label="Fund class"
              className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:w-auto sm:min-w-[280px]"
            >
              {CLASS_FILTERS.map((item) => {
                const active = classFilter === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setClassFilter(item.value)}
                    className={cn(
                      "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-all sm:px-3",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
                    )}
                  >
                    {item.value === "islamic" ? <IslamicMark size="sm" /> : null}
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AMC chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Asset managers
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAmc(null);
                    setClassFilter("all");
                    setQuery("");
                  }}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <AmcPill
                label="All AMCs"
                active={selectedAmc === null}
                onClick={() => setSelectedAmc(null)}
                icon={
                  <span
                    className={cn(
                      "inline-flex size-5 shrink-0 items-center justify-center rounded-md border sm:size-6",
                      selectedAmc === null
                        ? "border-primary-foreground/25 bg-white/90 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    <Building2 className="size-3 sm:size-3.5" />
                  </span>
                }
              />
              {amcOptions.map((item) => {
                const active = selectedAmc === item.value;
                return (
                  <AmcPill
                    key={item.value}
                    label={item.brand.shortName}
                    active={active}
                    count={item.count}
                    color={active ? item.brand.color : undefined}
                    onClick={() => setSelectedAmc(active ? null : item.value)}
                    icon={
                      <AmcBrandMark
                        label={item.value}
                        selected={active}
                        size="sm"
                        logoUrl={item.logoUrl ?? item.brand.logoUrl}
                        className="[&>span:first-child]:size-5 [&>span:first-child]:rounded-md [&>span:first-child]:shadow-none sm:[&>span:first-child]:size-6"
                      />
                    }
                  />
                );
              })}
            </div>
          </div>

          {periodLabel ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground/70 sm:text-xs">
              Based on{" "}
              <span className="font-medium text-muted-foreground">{periodLabel}</span>{" "}
              published holdings · live PSX prices · Rs 100k invested
            </p>
          ) : null}
        </div>
      </div>

      {/* Fund count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} fund{filtered.length !== 1 ? "s" : ""}
        {hasActiveFilters ? " (filtered)" : ""}
      </p>

      {/* Fund cards grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          No funds match the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((fund) => (
            <FundCard
              key={`${fund.amc}||${fund.fundName}`}
              fund={fund}
              shariahSymbols={shariahSymbols}
            />
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
  count,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  color?: string;
  count?: number;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[11px] font-semibold shadow-sm transition-all sm:h-9 sm:gap-1.5 sm:px-2.5 sm:text-xs",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-primary/20"
          : "border-border/80 bg-background text-foreground hover:border-primary/35 hover:bg-muted/40"
      )}
      style={
        active && color
          ? {
              backgroundColor: color,
              borderColor: color,
              boxShadow: `0 6px 16px -8px ${color}aa`,
            }
          : undefined
      }
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none",
            active ? "bg-white/20 text-inherit" : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FundCard({
  fund,
  shariahSymbols,
}: {
  fund: BreakdownFund;
  shariahSymbols: Set<string>;
}) {
  const brand = identifyAmcBrand(fund.amc);
  const iconUrl = amcIconUrl(brand) ?? fund.amcLogoUrl;
  const [imgFailed, setImgFailed] = React.useState(false);
  const isIslamicFund = fund.classFilter === "islamic" || isIslamicOrShariahName(fund.fundName);

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
          {fund.classFilter === "conventional" && !isIslamicFund ? (
            <div className="mb-0.5 flex flex-wrap items-center gap-1">
              <TypeBadge label="Conv." color="blue" />
            </div>
          ) : null}
          <div className="flex min-w-0 items-center gap-1.5">
            {fund.fundId ? (
              <Link
                href={`/market/mutual-funds/${fund.fundId}`}
                className="min-w-0 truncate text-sm font-bold leading-tight hover:underline"
                style={{ color: brand.color }}
              >
                {fund.fundName}
              </Link>
            ) : (
              <p
                className="min-w-0 truncate text-sm font-bold leading-tight"
                style={{ color: brand.color }}
              >
                {fund.fundName}
              </p>
            )}
            {isIslamicFund ? <FundIslamicIcon size="md" /> : null}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <AmcBrandMark
              label={fund.amc}
              size="sm"
              showName
              logoUrl={fund.amcLogoUrl}
              className="min-w-0 [&>span:first-child]:size-4 [&>span:first-child]:rounded [&>span:first-child]:shadow-none [&_span:last-child]:text-xs [&_span:last-child]:text-muted-foreground"
            />
            {fund.equityPct != null && (
              <span className="shrink-0 text-muted-foreground/70">
                · Equity {fund.equityPct.toFixed(1)}%
              </span>
            )}
          </div>
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
          <HoldingRow
            key={h.symbol ?? h.stockName ?? i}
            holding={h}
            shariahSymbols={shariahSymbols}
          />
        ))}
      </div>

      {/* Footer */}
      <div
        className="space-y-1.5 border-t border-border/30 px-3 py-2"
        style={{ background: `${brand.color}06` }}
      >
        {hasUnknown && (
          <p className="text-[10px] text-muted-foreground/60">
            Unknown holdings: {fund.unknownWeight.toFixed(1)}% — estimate may vary slightly since these
            allocations aren&apos;t publicly disclosed.
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

function HoldingRow({
  holding: h,
  shariahSymbols,
}: {
  holding: BreakdownHolding;
  shariahSymbols: Set<string>;
}) {
  const isOther = h.stockName === "Other Holdings" || !h.symbol;
  if (isOther) return null; // skip "Other Holdings" row in the table
  const isShariah = isShariahSymbol(h.symbol, shariahSymbols);

  return (
    <div
      className={cn(
        "grid items-center px-3 py-1 text-xs",
        h.plAmount != null && h.plAmount > 0 && "bg-emerald-50/40 dark:bg-emerald-950/10",
        h.plAmount != null && h.plAmount < 0 && "bg-red-50/40 dark:bg-red-950/10",
      )}
      style={{ gridTemplateColumns: "1fr 3.5rem 5rem" }}
    >
      <span className="flex min-w-0 items-center gap-1 text-foreground/80">
        <span className="min-w-0 truncate">{h.stockName}</span>
        {isShariah ? <IslamicMark size="sm" className="shrink-0" title="Shariah stock" /> : null}
      </span>
      <span className="text-right tabular-nums text-muted-foreground">{h.percentage.toFixed(1)}%</span>
      <span className={cn("text-right font-semibold tabular-nums", plColorClass(h.plAmount))}>
        {h.plAmount != null ? formatPKR(h.plAmount, { sign: true, decimals: 0 }) : "—"}
      </span>
    </div>
  );
}

function TypeBadge({
  label,
  color,
}: {
  label: string;
  color: "emerald" | "blue" | "violet";
}) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  }[color];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

