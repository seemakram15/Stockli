"use client";

import * as React from "react";
import Link from "next/link";
import { amcIconUrl, identifyAmcBrand } from "@/lib/amc-brands";
import { formatPercent, formatPKR, plColorClass } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HoldingsStrategyData, HoldingsStrategyFund } from "@/lib/services/market-strategy-holdings";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Priority AMCs shown first (by brand key), then alphabetical
const PRIORITY_KEYS = ["al-meezan", "ubl", "nbp", "hbl"];

function priorityIndex(key: string) {
  const i = PRIORITY_KEYS.indexOf(key);
  return i === -1 ? Infinity : i;
}

// Strip only the bare legal entity suffix, keep the descriptive name intact
function displayAmcName(fullName: string) {
  return fullName.replace(/\s+(Company\s+)?Limited$/i, "").trim();
}

export function MarketStrategyBoard({
  data,
  view = "detailed",
}: {
  data: HoldingsStrategyData;
  view?: "detailed" | "simple";
}) {
  const periodLabel =
    data.periodYear && data.periodMonth
      ? `${MONTHS[data.periodMonth - 1]} ${data.periodYear}`
      : "";

  // Group by canonical AMC name (f.amc) to guarantee uniqueness
  const groups = React.useMemo(() => {
    const map = new Map<string, HoldingsStrategyFund[]>();
    for (const f of data.funds) {
      map.set(f.amc, [...(map.get(f.amc) ?? []), f]);
    }
    return Array.from(map.entries())
      .map(([amc, funds]) => {
        const brand = identifyAmcBrand(amc);
        const logoUrl = funds.find((f) => f.amcLogoUrl)?.amcLogoUrl ?? null;
        return { amc, brand, logoUrl, funds };
      })
      .sort((a, b) => {
        const pa = priorityIndex(a.brand.key);
        const pb = priorityIndex(b.brand.key);
        if (pa !== pb) return pa - pb;
        return a.brand.fullName.localeCompare(b.brand.fullName);
      });
  }, [data.funds]);

  // Distribute AMCs across two columns, balancing by total fund-row count
  // (not card count) so both columns end at roughly the same height.
  const { left, right } = React.useMemo(() => {
    const priority = groups.filter((g) => priorityIndex(g.brand.key) < Infinity);
    const others = groups
      .filter((g) => priorityIndex(g.brand.key) === Infinity)
      .sort((a, b) => b.funds.length - a.funds.length); // largest first for better balance

    const l: typeof groups = [];
    const r: typeof groups = [];
    let lHeight = 0;
    let rHeight = 0;

    const rowsOf = (g: (typeof groups)[number]) => g.funds.length + 1.5; // + header weight

    priority.forEach((g, i) => {
      if (i % 2 === 0) {
        l.push(g);
        lHeight += rowsOf(g);
      } else {
        r.push(g);
        rHeight += rowsOf(g);
      }
    });

    for (const g of others) {
      if (lHeight <= rHeight) {
        l.push(g);
        lHeight += rowsOf(g);
      } else {
        r.push(g);
        rHeight += rowsOf(g);
      }
    }

    return { left: l, right: r };
  }, [groups]);

  return (
    <div className="space-y-3">
      {periodLabel && (
        <p className="text-xs text-muted-foreground/60">
          Based on <span className="font-medium text-muted-foreground">{periodLabel}</span> published holdings × today&apos;s PSX prices. Estimates may vary slightly for funds with undisclosed (&quot;Other Holdings&quot;) allocations.
        </p>
      )}

      {view === "simple" ? (
        <SimpleFundsGrid groups={groups} />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
          <div className="space-y-3">
            {left.map((g) => (
              <AmcCard key={g.amc} brand={g.brand} logoUrl={g.logoUrl} funds={g.funds} />
            ))}
          </div>
          <div className="space-y-3">
            {right.map((g) => (
              <AmcCard key={g.amc} brand={g.brand} logoUrl={g.logoUrl} funds={g.funds} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact AMC-grouped sections (same grouping as Detailed), arranged in a
 * dense multi-column masonry so every AMC is visible with minimal scrolling.
 */
function SimpleFundsGrid({
  groups,
}: {
  groups: {
    amc: string;
    brand: ReturnType<typeof identifyAmcBrand>;
    logoUrl: string | null;
    funds: HoldingsStrategyFund[];
  }[];
}) {
  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
      {groups.map((g) => (
        <div key={g.amc} className="mb-3 break-inside-avoid">
          <AmcCard brand={g.brand} logoUrl={g.logoUrl} funds={g.funds} compact />
        </div>
      ))}
    </div>
  );
}

function AmcCard({
  brand,
  logoUrl,
  funds,
  compact = false,
}: {
  brand: ReturnType<typeof identifyAmcBrand>;
  logoUrl: string | null;
  funds: HoldingsStrategyFund[];
  compact?: boolean;
}) {
  const iconUrl = logoUrl ?? amcIconUrl(brand);
  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <div
      className="overflow-hidden rounded-xl border-2 bg-card"
      style={{ borderColor: `${brand.color}30` }}
    >
      {/* AMC header */}
      <div
        className={cn("flex items-center gap-2.5", compact ? "px-2.5 py-1.5" : "px-3 py-2")}
        style={{
          background: `linear-gradient(135deg, ${brand.color}12 0%, ${brand.color}04 100%)`,
          borderBottom: `1px solid ${brand.color}20`,
        }}
      >
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border",
            compact ? "size-6" : "size-7"
          )}
          style={{ borderColor: `${brand.color}40`, backgroundColor: `${brand.color}18` }}
        >
          {iconUrl && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt={brand.shortName} className="h-full w-full object-contain p-0.5" onError={() => setImgFailed(true)} />
          ) : (
            <span className="text-[8px] font-bold leading-none" style={{ color: brand.color }}>
              {brand.initials}
            </span>
          )}
        </div>
        <span className={cn("min-w-0 truncate font-bold", compact ? "text-xs" : "text-sm")} style={{ color: brand.color }}>
          {displayAmcName(brand.fullName)}
        </span>
      </div>

      {/* Fund rows — no column headers */}
      <div className="divide-y divide-border/30">
        {funds.map((f) => (
          <FundRow key={f.fundId ?? f.fundName} fund={f} compact={compact} />
        ))}
      </div>
    </div>
  );
}

function FundRow({ fund: f, compact = false }: { fund: HoldingsStrategyFund; compact?: boolean }) {
  const name = f.fundId ? (
    <Link href={`/market/mutual-funds/${f.fundId}`} className="hover:underline">
      {f.fundName}
    </Link>
  ) : (
    <span>{f.fundName}</span>
  );

  return (
    <div
      className={cn(
        "grid items-center text-xs",
        compact ? "px-2.5 py-1" : "px-3 py-1.5",
        rowTint(f.estimatedReturn)
      )}
      style={{
        gridTemplateColumns: compact ? "minmax(0,1fr) 3.25rem 5rem" : "minmax(0,1fr) 4rem 6.5rem",
        gap: "0.5rem",
      }}
    >
      <span className="min-w-0 truncate text-foreground/80">{name}</span>
      <span
        className={cn(
          "whitespace-nowrap text-right font-semibold tabular-nums",
          plColorClass(f.holdingsReturnPct)
        )}
      >
        {f.holdingsReturnPct != null ? formatPercent(f.holdingsReturnPct) : "—"}
      </span>
      <span
        className={cn(
          "whitespace-nowrap text-right font-bold tabular-nums",
          plColorClass(f.estimatedReturn)
        )}
      >
        {f.estimatedReturn != null ? formatPKR(f.estimatedReturn, { sign: true }) : "—"}
      </span>
    </div>
  );
}

function rowTint(value: number | null) {
  if (value == null) return "";
  if (value > 0) return "bg-emerald-50/60 dark:bg-emerald-950/20";
  if (value < 0) return "bg-red-50/60 dark:bg-red-950/20";
  return "";
}
