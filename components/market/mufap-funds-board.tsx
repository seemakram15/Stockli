"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowDownUp,
  BadgePercent,
  BarChart3,
  Coins,
  ExternalLink,
  LineChart,
  PieChart,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { IconChip } from "@/components/ui/accent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPanel } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  plColorClass,
} from "@/lib/format";
import { amcIconUrl, identifyAmcBrand } from "@/lib/amc-brands";
import { cn } from "@/lib/utils";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import { FundIslamicIcon, IslamicMark, isIslamicOrShariahName } from "@/components/market/islamic-mark";
import type { FundClassFilter, MufapFund, MufapFundsData } from "@/lib/services/mufap";

type SortKey =
  | "name"
  | "amc"
  | "nav"
  | "d1"
  | "mtd"
  | "ytd"
  | "d365";

type StrategyFilter = "all" | "stock" | "income" | "money-market" | "allocation";

const CLASS_FILTERS: Array<{ value: FundClassFilter; label: string }> = [
  { value: "all", label: "All funds" },
  { value: "islamic", label: "Islamic funds" },
  { value: "conventional", label: "Conventional funds" },
  { value: "pension", label: "Pension funds" },
];

const STRATEGY_FILTERS: Array<{ value: StrategyFilter; label: string; icon: LucideIcon }> = [
  { value: "all", label: "All", icon: BadgePercent },
  { value: "stock", label: "Stock funds", icon: BarChart3 },
  { value: "money-market", label: "Money market", icon: Coins },
  { value: "income", label: "Income", icon: LineChart },
  { value: "allocation", label: "Asset allocation", icon: PieChart },
];

export function MufapFundsBoard({
  data,
  title,
  etfMode = false,
}: {
  data: MufapFundsData;
  title: string;
  etfMode?: boolean;
}) {
  const defaultFundClass: FundClassFilter = etfMode ? "all" : "islamic";
  const defaultStrategy: StrategyFilter = etfMode ? "all" : "stock";
  const [query, setQuery] = React.useState("");
  const [fundClass, setFundClass] = React.useState<FundClassFilter>(defaultFundClass);
  const [strategy, setStrategy] = React.useState<StrategyFilter>(defaultStrategy);
  const [amc, setAmc] = React.useState("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("d1");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const amcOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    const logos = new Map<string, string>();
    for (const fund of data.funds) {
      counts.set(fund.amc, (counts.get(fund.amc) ?? 0) + 1);
      if (fund.amcLogoUrl && !logos.has(fund.amc)) logos.set(fund.amc, fund.amcLogoUrl);
    }
    return data.amcs
      .map((item) => ({
        value: item,
        brand: identifyAmcBrand(item),
        count: counts.get(item) ?? 0,
        logoUrl: logos.get(item) ?? identifyAmcBrand(item).logoUrl,
      }))
      .sort((a, b) => a.brand.shortName.localeCompare(b.brand.shortName));
  }, [data.amcs, data.funds]);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.funds
      .filter((fund) => {
        const matchesQuery =
          !q ||
          fund.name.toLowerCase().includes(q) ||
          fund.amc.toLowerCase().includes(q) ||
          fund.type.toLowerCase().includes(q);
        const matchesClass = fundClass === "all" || fund.classFilter === fundClass;
        const matchesStrategy = strategy === "all" || strategyMatches(fund, strategy);
        const matchesAmc = amc === "all" || fund.amc === amc;
        return matchesQuery && matchesClass && matchesStrategy && matchesAmc;
      })
      .sort((a, b) => compareFunds(a, b, sortKey, sortDir));
  }, [amc, data.funds, fundClass, query, sortDir, sortKey, strategy]);

  const filterSummary = `${amc === "all" ? "All AMCs" : identifyAmcBrand(amc).shortName} · ${
    rows.length
  } fund${rows.length === 1 ? "" : "s"}`;

  const groups = React.useMemo(() => {
    const map = new Map<string, MufapFund[]>();
    for (const fund of rows) {
      const key = fund.amcShort || identifyAmcBrand(fund.amc).shortName || fund.amc;
      map.set(key, [...(map.get(key) ?? []), fund]);
    }
    return Array.from(map.entries())
      .map(([label, funds]) => ({
        label,
        amc: funds[0]?.amc ?? label,
        logoUrl: funds.find((fund) => fund.amcLogoUrl)?.amcLogoUrl ?? null,
        funds,
        stockFunds: funds.filter((fund) => strategyMatches(fund, "stock")).length,
        latestDate:
          funds
            .map((fund) => fund.validityDate)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "amc" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-4">
      <Card variant="feature" className="overflow-hidden">
        <CardHeader className="gap-5 border-b border-border bg-gradient-to-br from-card via-card to-amber-500/5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <IconChip accent="amber" variant="gradient"><BadgePercent /></IconChip>
              <div>
                <CardTitle>{title}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  MUFAP official data · updated {formatDateTime(data.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="size-4" />
                Refresh
              </Button>
              <Button asChild variant="outline">
                <a href={data.sourceUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  MUFAP
                </a>
              </Button>
            </div>
          </div>

          <FilterPanel title="Fund filters" summary={filterSummary}>
            <div className="space-y-4">
              <div className="grid gap-2 xl:grid-cols-[minmax(260px,1fr)_auto]">
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search fund name..."
                    className="pl-9"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setAmc("all");
                    setFundClass(defaultFundClass);
                    setStrategy(defaultStrategy);
                  }}
                >
                  Clear filters
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <FilterGroup label="AMC">
                  <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
                    <FilterPill
                      active={amc === "all"}
                      onClick={() => setAmc("all")}
                      label="All"
                      count={data.funds.length}
                    />
                    {amcOptions.map((item) => (
                      <FilterPill
                        key={item.value}
                        active={amc === item.value}
                        onClick={() => setAmc(item.value)}
                        label={item.brand.shortName}
                        count={item.count}
                        icon={
                          <AmcBrandMark
                            label={item.value}
                            selected={amc === item.value}
                            size="sm"
                            logoUrl={item.logoUrl}
                          />
                        }
                      />
                    ))}
                  </div>
                </FilterGroup>

                {!etfMode && (
                  <FilterGroup label="Fund class">
                    <div className="flex flex-wrap gap-2">
                      {CLASS_FILTERS.map((item) => (
                        <FilterPill
                          key={item.value}
                          active={fundClass === item.value}
                          onClick={() => setFundClass(item.value)}
                          label={item.label}
                          icon={
                            item.value === "islamic" ? (
                              <IslamicMark size="sm" />
                            ) : undefined
                          }
                        />
                      ))}
                    </div>
                  </FilterGroup>
                )}

                <FilterGroup label="Type" isLast>
                  <div className="flex flex-wrap gap-2">
                    {STRATEGY_FILTERS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <FilterPill
                          key={item.value}
                          active={strategy === item.value}
                          onClick={() => setStrategy(item.value)}
                          label={item.label}
                          icon={
                            <Icon
                              className={cn(
                                "size-4",
                                strategy === item.value ? "text-white" : "text-muted-foreground"
                              )}
                            />
                          }
                        />
                      );
                    })}
                  </div>
                </FilterGroup>
              </div>
            </div>
          </FilterPanel>
        </CardHeader>

        <CardContent className="space-y-4 p-3 sm:p-4">
          {groups.map((group) => {
            const brand = identifyAmcBrand(group.amc);
            return (
            <section
              key={group.label}
              className="overflow-hidden rounded-2xl border-2 bg-background shadow-soft transition-shadow hover:shadow-soft-lg"
              style={{ borderColor: `${brand.color}35` }}
            >
              {/* AMC header with brand color */}
              <div
                className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{
                  background: `linear-gradient(135deg, ${brand.color}10 0%, ${brand.color}04 60%, transparent 100%)`,
                  borderColor: `${brand.color}30`,
                }}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <AmcGroupLogo brand={brand} logoUrl={group.logoUrl} />
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold" style={{ color: brand.color }}>
                      {brand.shortName}
                    </h3>
                    <p className="truncate text-xs text-muted-foreground/70">{group.amc}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: `${brand.color}15`, color: brand.color }}
                  >
                    {group.funds.length} fund{group.funds.length !== 1 ? "s" : ""}
                  </span>
                  {group.stockFunds > 0 && (
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {group.stockFunds} stock
                    </span>
                  )}
                  {group.latestDate && (
                    <span className="text-xs text-muted-foreground/60">
                      Updated {group.latestDate}
                    </span>
                  )}
                </div>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 p-3 sm:hidden">
                {group.funds.map((fund) => (
                  <FundMobileCard
                    key={`${fund.fundId ?? fund.name}-${fund.type}-mobile`}
                    fund={fund}
                    etfMode={etfMode}
                    brandColor={brand.color}
                  />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto scrollbar-thin sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead label="Fund name" active={sortKey === "name"} onClick={() => toggleSort("name")} className="min-w-[260px]" />
                      <TableHead className="w-40">Type</TableHead>
                      <SortableHead label="NAV" active={sortKey === "nav"} onClick={() => toggleSort("nav")} align="right" className="w-28" />
                      <SortableHead label="1 day" active={sortKey === "d1"} onClick={() => toggleSort("d1")} align="right" className="w-24" />
                      <SortableHead label="MTD" active={sortKey === "mtd"} onClick={() => toggleSort("mtd")} align="right" className="w-24" />
                      <SortableHead label="YTD" active={sortKey === "ytd"} onClick={() => toggleSort("ytd")} align="right" className="w-24" />
                      <SortableHead label="365 days" active={sortKey === "d365"} onClick={() => toggleSort("d365")} align="right" className="w-28" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.funds.map((fund) => (
                      <TableRow key={`${fund.fundId ?? fund.name}-${fund.type}`}>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-1.5">
                            {fund.fundId ? (
                              <Link
                                href={`/${etfMode ? "market/etfs" : "market/mutual-funds"}/${fund.fundId}`}
                                className="min-w-0 truncate font-semibold hover:text-primary"
                              >
                                {fund.name}
                              </Link>
                            ) : (
                              <p className="min-w-0 truncate font-semibold">{fund.name}</p>
                            )}
                            {fund.classFilter === "islamic" || isIslamicOrShariahName(fund.name) ? (
                              <FundIslamicIcon size="md" />
                            ) : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {fund.validityDate ?? "—"} · {fund.riskProfile ?? "Risk N/A"}
                          </p>
                        </TableCell>
                        <TableCell className="w-40 truncate text-xs text-muted-foreground">{fund.type}</TableCell>
                        <TableCell className="w-28 text-right tabular-nums">{formatNumber(fund.nav, 4)}</TableCell>
                        <ReturnCell value={fund.d1} className="w-24" />
                        <ReturnCell value={fund.mtd} className="w-24" />
                        <ReturnCell value={fund.ytd} className="w-24" />
                        <ReturnCell value={fund.d365} className="w-28" />
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
            );
          })}
          {rows.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              {data.unavailable
                ? data.errorMessage ?? "MUFAP data is temporarily unavailable. Please refresh in a moment."
                : "No funds match the current filters."}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function FundMobileCard({ fund, etfMode, brandColor }: { fund: MufapFund; etfMode: boolean; brandColor: string }) {
  const islamic = fund.classFilter === "islamic" || isIslamicOrShariahName(fund.name);
  return (
    <div
      className="rounded-xl border bg-card p-3"
      style={{ borderColor: `${brandColor}25` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {fund.fundId ? (
              <Link
                href={`/${etfMode ? "market/etfs" : "market/mutual-funds"}/${fund.fundId}`}
                className="min-w-0 truncate font-semibold hover:text-primary"
              >
                {fund.name}
              </Link>
            ) : (
              <p className="min-w-0 truncate font-semibold">{fund.name}</p>
            )}
            {islamic ? <FundIslamicIcon size="md" /> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{fund.type}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">NAV</p>
          <p className="font-semibold tabular-nums">{formatNumber(fund.nav, 4)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
        <MobileMetric label="1D" value={formatPercent(fund.d1)} tone={fund.d1} />
        <MobileMetric label="MTD" value={formatPercent(fund.mtd)} tone={fund.mtd} />
        <MobileMetric label="YTD" value={formatPercent(fund.ytd)} tone={fund.ytd} />
        <MobileMetric label="365D" value={formatPercent(fund.d365)} tone={fund.d365} align="right" />
      </div>
    </div>
  );
}

function MobileMetric({
  label,
  value,
  tone,
  align = "left",
}: {
  label: string;
  value: React.ReactNode;
  tone?: number | null;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", tone == null ? "" : plColorClass(tone))}>
        {value}
      </p>
    </div>
  );
}

function AmcGroupLogo({ brand, logoUrl }: { brand: ReturnType<typeof identifyAmcBrand>; logoUrl: string | null }) {
  const iconUrl = amcIconUrl(brand) ?? logoUrl;
  const [failed, setFailed] = React.useState(false);
  return (
    <div
      className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 shadow-md"
      style={{ borderColor: `${brand.color}40`, backgroundColor: `${brand.color}12` }}
    >
      {iconUrl && !failed ? (
        <Image
          src={iconUrl}
          alt={brand.shortName}
          fill
          unoptimized
          className="object-contain p-1.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-sm font-bold" style={{ color: brand.color }}>
          {brand.initials}
        </span>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
  isLast = false,
}: {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 py-3 md:grid-cols-[92px_minmax(0,1fr)] md:items-start",
        !isLast && "border-b border-border"
      )}
    >
      <p className="pt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  icon,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold shadow-sm transition-colors",
        active
          ? "border-transparent bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-sm shadow-amber-500/25"
          : "border-border bg-card text-foreground hover:border-amber-500/40 hover:bg-accent"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs tabular-nums",
            active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ReturnCell({ value, className }: { value: number | null; className?: string }) {
  return (
    <TableCell className={cn("text-right font-medium tabular-nums", plColorClass(value), className)}>
      {formatPercent(value)}
    </TableCell>
  );
}

function SortableHead({
  label,
  active,
  align = "left",
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  align?: "left" | "right";
  onClick: () => void;
  className?: string;
}) {
  return (
    <TableHead className={cn(align === "right" ? "text-right" : "", className)}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-foreground"
      >
        {label}
        <ArrowDownUp className={cn("size-3", active ? "text-primary" : "text-muted-foreground")} />
      </button>
    </TableHead>
  );
}

function compareFunds(a: MufapFund, b: MufapFund, key: SortKey, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1;
  if (key === "name") return a.name.localeCompare(b.name) * factor;
  if (key === "amc") return a.amc.localeCompare(b.amc) * factor;
  return (numericValue(a, key) - numericValue(b, key)) * factor;
}

function numericValue(fund: MufapFund, key: SortKey) {
  if (key === "nav") return fund.nav ?? -Infinity;
  if (key === "d1") return fund.d1 ?? -Infinity;
  if (key === "mtd") return fund.mtd ?? -Infinity;
  if (key === "ytd") return fund.ytd ?? -Infinity;
  if (key === "d365") return fund.d365 ?? -Infinity;
  return 0;
}

function strategyMatches(fund: MufapFund, strategy: StrategyFilter) {
  const haystack = `${fund.name} ${fund.type} ${fund.category} ${fund.sector}`.toLowerCase();
  if (strategy === "stock") return /\b(stock|equity|index|sector)\b/.test(haystack);
  if (strategy === "money-market") return haystack.includes("money market") || haystack.includes("cash");
  if (strategy === "income") return haystack.includes("income") || haystack.includes("sovereign");
  return haystack.includes("asset allocation") || haystack.includes("balanced") || haystack.includes("allocation");
}
