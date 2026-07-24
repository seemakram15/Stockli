import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Activity,
  BadgePercent,
  Building2,
  CalendarClock,
  Coins,
  ExternalLink,
  Landmark,
  LineChart,
  Mail,
  Percent,
  Phone,
  PieChart,
  Shield,
  Wallet,
} from "lucide-react";
import { getMufapFundById, type MufapAssetAllocation, type MufapFund } from "@/lib/services/mufap";
import { getFundHoldingsReturn } from "@/lib/services/fund-returns";
import { SmartBackLink } from "@/components/smart-back-link";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { AccentPill, IconChip } from "@/components/ui/accent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import { FundHoldingsSection } from "@/components/market/fund-holdings-section";
import { IslamicMark } from "@/components/market/islamic-mark";
import { NavPerformanceChart } from "@/components/charts/nav-performance-chart";
import { buildPageMetadata } from "@/lib/seo";
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPKR,
  plColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fundId: string }>;
}): Promise<Metadata> {
  const { fundId } = await params;
  const fund = await getMufapFundById(fundId);
  if (!fund) {
    return buildPageMetadata({
      title: "Fund profile",
      description: "Pakistan mutual fund profile on MyStockli.",
      path: `/market/mutual-funds/${fundId}`,
      index: false,
    });
  }
  return buildPageMetadata({
    title: fund.name,
    description: `${fund.name} by ${fund.amc} — NAV, category, returns, net assets and holdings on MyStockli.`,
    path: `/market/mutual-funds/${fundId}`,
    keywords: [fund.name, fund.amc, "Pakistan mutual fund", "MUFAP"],
  });
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const ALLOCATION_COLORS = [
  "bg-teal-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-slate-400",
];

export default async function MutualFundDetailPage({
  params,
}: {
  params: Promise<{ fundId: string }>;
}) {
  const { fundId } = await params;
  const fund = await getMufapFundById(fundId);
  if (!fund) notFound();

  const holdingsReturn = await getFundHoldingsReturn(fund.name);
  const holdingsPeriod =
    holdingsReturn.periodYear && holdingsReturn.periodMonth
      ? `${MONTHS[holdingsReturn.periodMonth - 1]} ${holdingsReturn.periodYear}`
      : null;
  const has1dHoldings = holdingsReturn.returnPct != null;
  const dayReturn = has1dHoldings ? holdingsReturn.returnPct : fund.d1;
  const dayPnl = has1dHoldings ? holdingsReturn.estimateOn100k : fund.profitOn100k;
  const isIslamic = fund.classFilter === "islamic";

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <SmartBackLink fallbackHref="/market/mutual-funds" label="Back to funds" />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-card p-4 shadow-soft ring-1 ring-foreground/10 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/8 via-transparent to-teal-500/5" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <AmcBrandMark label={fund.amc} size="lg" logoUrl={fund.amcLogoUrl} />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <AccentPill accent="amber" className="text-[10px] uppercase tracking-wide">
                  Fund profile
                </AccentPill>
                {fund.riskProfile && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {fund.riskProfile}
                  </span>
                )}
              </div>
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                <span className="text-balance">{fund.name}</span>
                {isIslamic ? (
                  <IslamicMark size="lg" title="Islamic / Shariah" />
                ) : null}
              </h1>
              <p className="text-sm text-muted-foreground">
                {fund.amc}
                {fund.category ? ` · ${fund.category}` : fund.type ? ` · ${fund.type}` : ""}
                {fund.sector ? ` · ${fund.sector}` : ""}
              </p>
            </div>
          </div>
          {fund.profileUrl ? (
            <Button asChild variant="outline" size="sm" className="shrink-0 self-start">
              <a href={fund.profileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                MUFAP
              </a>
            </Button>
          ) : null}
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="NAV"
          value={formatNumber(fund.nav, 4)}
          accent="amber"
          icon={<Coins className="size-4" />}
          sub={<span className="text-muted-foreground">Offer {formatNumber(fund.offerPrice, 4)}</span>}
        />
        <StatCard
          label="1-day return"
          value={formatPercent(dayReturn)}
          tone={toneOf(dayReturn)}
          accent="sky"
          icon={<CalendarClock className="size-4" />}
          sub={
            <span className="text-muted-foreground">
              {has1dHoldings
                ? `Holdings est.${holdingsPeriod ? ` · ${holdingsPeriod}` : ""}`
                : "MUFAP NAV"}
            </span>
          }
        />
        <StatCard
          label="MTD"
          value={formatPercent(fund.mtd)}
          tone={toneOf(fund.mtd)}
          accent="violet"
          icon={<LineChart className="size-4" />}
        />
        <StatCard
          label="YTD"
          value={formatPercent(fund.ytd)}
          tone={toneOf(fund.ytd)}
          accent="indigo"
          icon={<Activity className="size-4" />}
        />
        <StatCard
          label="Net assets"
          value={formatNetAssets(fund.netAssets)}
          accent="teal"
          icon={<Landmark className="size-4" />}
          sub={
            <span className="text-muted-foreground">
              {fund.detailDate ? `as of ${formatDate(fund.detailDate)}` : "MUFAP"}
            </span>
          }
        />
        <StatCard
          label="Rs 100k · 1-day"
          value={formatPKR(dayPnl, { sign: true })}
          tone={toneOf(dayPnl)}
          accent="emerald"
          icon={<Wallet className="size-4" />}
        />
      </div>

      {/* Graph */}
      <Card className="overflow-hidden rounded-3xl shadow-soft ring-1 ring-foreground/10">
        <CardHeader className="flex-row items-center gap-3 border-b bg-gradient-to-r from-violet-500/10 via-transparent to-transparent">
          <IconChip accent="violet" variant="gradient">
            <Activity />
          </IconChip>
          <div>
            <CardTitle className="font-bold">NAV performance</CardTitle>
            <p className="text-xs text-muted-foreground">Historical net asset value</p>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <NavPerformanceChart history={fund.navHistory} />
        </CardContent>
      </Card>

      {/* Fund returns */}
      <Card className="overflow-hidden rounded-3xl shadow-soft ring-1 ring-foreground/10">
        <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-sky-500/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <IconChip accent="sky" variant="gradient">
              <LineChart />
            </IconChip>
            <div>
              <CardTitle className="font-bold">Fund returns</CardTitle>
              <p className="text-xs text-muted-foreground">Official MUFAP NAV returns</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2.5 pt-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <Return label="YTD" value={fund.ytd} />
          <Return label="MTD" value={fund.mtd} />
          <Return label="1 Day" value={fund.d1} />
          <Return label="15 Days" value={fund.d15} />
          <Return label="1 Month" value={fund.d30} />
          <Return label="3 Months" value={fund.d90} />
          <Return label="6 Months" value={fund.d180} />
          <Return label="9 Months" value={fund.d270} />
          <Return label="1 Year" value={fund.d365} />
          <Return label="2 Years" value={fund.y2} />
          <Return label="3 Years" value={fund.y3} />
        </CardContent>
      </Card>

      {/* Profile — full information */}
      <ProfileSection fund={fund} />

      {/* Asset allocation */}
      <AssetAllocationSection
        items={fund.assetAllocation}
        asOf={fund.detailDate}
      />

      {/* Holdings */}
      <FundHoldingsSection fundName={fund.name} />
    </div>
  );
}

function ProfileSection({ fund }: { fund: MufapFund }) {
  return (
    <Card className="overflow-hidden rounded-3xl shadow-soft ring-1 ring-foreground/10">
      <CardHeader className="border-b bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
        <div className="flex items-center gap-3">
          <IconChip accent="amber" variant="gradient">
            <BadgePercent />
          </IconChip>
          <div>
            <CardTitle className="font-bold">Profile</CardTitle>
            <p className="text-xs text-muted-foreground">
              Fund identity, size, costs, and operating details
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-5 sm:gap-4 md:grid-cols-2">
        <ProfileBlock
          title="Overview"
          icon={<Building2 className="size-3.5" />}
        >
          <InfoRow label="AMC" value={fund.amc} />
          <InfoRow label="Category" value={fund.category || fund.type || "—"} />
          <InfoRow label="Sector" value={fund.sector || "—"} />
          <InfoRow label="Risk profile" value={fund.riskProfile ?? "—"} />
          <InfoRow label="Rating" value={fund.rating ?? "—"} />
          <InfoRow label="Rating date" value={formatDate(fund.ratingDate)} />
          <InfoRow label="Benchmark" value={fund.benchmark ?? "—"} />
          <InfoRow label="Class" value={classLabel(fund.classFilter)} />
        </ProfileBlock>

        <ProfileBlock title="Size & pricing" icon={<Landmark className="size-3.5" />}>
          <InfoRow label="Net assets" value={formatNetAssetsLong(fund.netAssets)} />
          <InfoRow
            label="Net assets (excl. FoFs)"
            value={formatNetAssetsLong(fund.netAssetsExFof)}
          />
          <InfoRow label="NAV" value={formatNumber(fund.nav, 4)} />
          <InfoRow label="Offer price" value={formatNumber(fund.offerPrice, 4)} />
          <InfoRow label="As of" value={formatDate(fund.detailDate)} />
        </ProfileBlock>

        <ProfileBlock title="Expense ratio" icon={<Percent className="size-3.5" />}>
          <InfoRow label="TER (YTD)" value={formatPercentPlain(fund.terYtd)} />
          <InfoRow label="TER (MTD)" value={formatPercentPlain(fund.terMtd)} />
          <InfoRow label="Govt levies (YTD)" value={formatPercentPlain(fund.govLeviesYtd)} />
          <InfoRow label="Govt levies (MTD)" value={formatPercentPlain(fund.govLeviesMtd)} />
          <InfoRow
            label="Selling & marketing"
            value={formatPercentPlain(fund.sellingMarketingPct)}
          />
          <p className="pt-2 text-xs text-muted-foreground">
            TER is the total expense ratio — ongoing fund costs as a % of assets.
          </p>
        </ProfileBlock>

        <ProfileBlock title="Fund information" icon={<Shield className="size-3.5" />}>
          <InfoRow label="Fund code" value={fund.fundCode ?? "—"} />
          <InfoRow label="Inception" value={formatDate(fund.inceptionDate)} />
          <InfoRow label="Front-end load" value={formatLoad(fund.frontLoad)} />
          <InfoRow label="Back-end load" value={formatLoad(fund.backLoad)} />
          <InfoRow label="Contingent load" value={formatLoad(fund.contingentLoad)} />
          <InfoRow label="Dealing days" value={fund.dealingDays ?? "—"} />
          <InfoRow label="Cut-off time" value={fund.cutOffTime ?? "—"} />
          <InfoRow label="Pricing mechanism" value={fund.priceMechanism ?? "—"} />
          <InfoRow label="Trustee" value={fund.trusteeName ?? "—"} />
          <InfoRow label="Leverage" value={fund.leverage ?? "—"} />
        </ProfileBlock>

        {(fund.amcEmail || fund.amcPhone || fund.amcUrl) && (
          <ProfileBlock
            title="AMC contact"
            icon={<Mail className="size-3.5" />}
            className="md:col-span-2"
          >
            <div className="flex flex-col gap-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
              {fund.amcEmail && (
                <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" />
                  <span className="truncate">{fund.amcEmail}</span>
                </span>
              )}
              {fund.amcPhone && (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5 shrink-0" />
                  {fund.amcPhone}
                </span>
              )}
              {fund.amcUrl && (
                <a
                  href={normalizeUrl(fund.amcUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  <span className="truncate">{fund.amcUrl}</span>
                </a>
              )}
            </div>
          </ProfileBlock>
        )}
      </CardContent>
    </Card>
  );
}

function AssetAllocationSection({
  items,
  asOf,
}: {
  items: MufapAssetAllocation[];
  asOf: string | null;
}) {
  const sorted = [...items]
    .filter((item) => (item.percent != null && item.percent !== 0) || item.amount != null)
    .sort((a, b) => Math.abs(b.percent ?? 0) - Math.abs(a.percent ?? 0));

  const positiveTotal = sorted.reduce(
    (sum, item) => sum + Math.max(0, item.percent ?? 0),
    0
  );

  return (
    <Card className="overflow-hidden rounded-3xl shadow-soft ring-1 ring-foreground/10">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-teal-500/10 via-transparent to-transparent">
        <div className="flex items-center gap-3">
          <IconChip accent="teal" variant="gradient">
            <PieChart />
          </IconChip>
          <div>
            <CardTitle className="font-bold">Asset allocation</CardTitle>
            <p className="text-xs text-muted-foreground">
              How the fund’s assets are distributed
            </p>
          </div>
        </div>
        {asOf && (
          <span className="text-xs text-muted-foreground">as of {formatDate(asOf)}</span>
        )}
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {!sorted.length ? (
          <p className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            MUFAP has not published asset allocation for this fund yet.
          </p>
        ) : (
          <>
            {/* Stacked composition bar */}
            <div className="space-y-2">
              <div className="flex h-4 overflow-hidden rounded-full bg-muted ring-1 ring-border/60">
                {sorted.map((item, index) => {
                  const pct = Math.max(0, item.percent ?? 0);
                  if (pct <= 0) return null;
                  const width = positiveTotal > 0 ? (pct / positiveTotal) * 100 : 0;
                  return (
                    <div
                      key={item.label}
                      className={cn("h-full", ALLOCATION_COLORS[index % ALLOCATION_COLORS.length])}
                      style={{ width: `${width}%` }}
                      title={`${item.label}: ${formatPercentPlain(item.percent)}`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Each colour is an asset class. Hover a segment on desktop for the label.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map((item, index) => {
                const pct = item.percent ?? 0;
                const negative = pct < 0 || (item.amount ?? 0) < 0;
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/80 bg-muted/15 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "mt-0.5 size-2.5 shrink-0 rounded-full",
                            negative
                              ? "bg-rose-500"
                              : ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]
                          )}
                        />
                        <p className="min-w-0 text-sm font-semibold leading-snug">{item.label}</p>
                      </div>
                      <p
                        className={cn(
                          "shrink-0 text-sm font-bold tabular-nums",
                          negative ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                        )}
                      >
                        {formatPercentPlain(item.percent)}
                      </p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          negative
                            ? "bg-rose-500"
                            : ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]
                        )}
                        style={{ width: `${Math.max(2, Math.min(100, Math.abs(pct)))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                      {item.amount != null
                        ? `${formatNumber(item.amount, 2)} mn PKR`
                        : "Amount not published"}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileBlock({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/80 bg-muted/15 p-4 shadow-sm",
        className
      )}
    >
      <h3 className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2.5 text-sm font-bold tracking-tight">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h3>
      <div className="space-y-0">{children}</div>
    </section>
  );
}

function toneOf(value: number | null | undefined): "gain" | "loss" | "default" {
  if (value == null || Number.isNaN(value)) return "default";
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "default";
}

function formatLoad(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value, value % 1 === 0 ? 0 : 2)}%`;
}

function formatPercentPlain(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value, 2)}%`;
}

/** MUFAP net assets are published in PKR millions. */
function formatNetAssets(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) return `Rs ${formatNumber(value / 1000, 2)}B`;
  return `Rs ${formatNumber(value, 1)}M`;
}

function formatNetAssetsLong(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `Rs ${formatNumber(value / 1000, 2)} Bn (${formatNumber(value, 2)} mn)`;
  }
  return `Rs ${formatNumber(value, 2)} mn`;
}

function classLabel(filter: MufapFund["classFilter"]): string {
  if (filter === "islamic") return "Islamic / Shariah";
  if (filter === "pension") return "Pension";
  if (filter === "conventional") return "Conventional";
  return "—";
}

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function Return({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-base font-bold tabular-nums sm:text-lg", plColorClass(value))}>
        {formatPercent(value)}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold leading-snug">{value}</span>
    </div>
  );
}
