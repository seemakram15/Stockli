import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Activity,
  BadgePercent,
  CalendarClock,
  Coins,
  ExternalLink,
  Info,
  Landmark,
  LineChart,
  Mail,
  Percent,
  Phone,
  PieChart,
  Wallet,
} from "lucide-react";
import { getMufapFundById } from "@/lib/services/mufap";
import { getFundHoldingsReturn } from "@/lib/services/fund-returns";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/accent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import { FundHoldingsSection } from "@/components/market/fund-holdings-section";
import { NavPerformanceChart } from "@/components/charts/nav-performance-chart";
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPKR,
  plColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fund profile" };

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SmartBackLink fallbackHref="/market/mutual-funds" label="Back to funds" />

      <PageHeader
        icon={<BadgePercent />}
        eyebrow="Fund profile"
        accent="amber"
        title={fund.name}
        description={`${fund.amc} · ${fund.category || fund.type}`}
        actions={
          fund.profileUrl ? (
            <Button asChild variant="outline">
              <a href={fund.profileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                MUFAP profile
              </a>
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="NAV"
          value={formatNumber(fund.nav, 4)}
          accent="amber"
          icon={<Coins className="size-4" />}
          sub={
            holdingsPeriod ? (
              <span className="text-muted-foreground">as of today</span>
            ) : undefined
          }
        />
        <StatCard
          label="1-day (holdings est.)"
          value={has1dHoldings ? formatPercent(holdingsReturn.returnPct) : formatPercent(fund.d1)}
          tone={toneOf(has1dHoldings ? holdingsReturn.returnPct : fund.d1)}
          accent="sky"
          icon={<CalendarClock className="size-4" />}
          sub={
            has1dHoldings ? (
              <span className="text-muted-foreground">
                {holdingsReturn.pricedHoldings}/{holdingsReturn.totalHoldings} priced
                {holdingsPeriod ? ` · ${holdingsPeriod}` : ""}
              </span>
            ) : (
              <span className="text-muted-foreground">MUFAP NAV move</span>
            )
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
          label="Rs 100k 1-day P/L"
          value={formatPKR(
            has1dHoldings ? holdingsReturn.estimateOn100k : fund.profitOn100k,
            { sign: true }
          )}
          tone={toneOf(has1dHoldings ? holdingsReturn.estimateOn100k : fund.profitOn100k)}
          accent="emerald"
          icon={<Wallet className="size-4" />}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <IconChip accent="violet" variant="gradient"><Activity /></IconChip>
          <CardTitle>NAV performance</CardTitle>
        </CardHeader>
        <CardContent>
          <NavPerformanceChart history={fund.navHistory} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <IconChip accent="violet" variant="gradient"><LineChart /></IconChip>
              <CardTitle>Fund returns</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">Official MUFAP NAV returns</span>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AmcBrandMark label={fund.amc} size="lg" logoUrl={fund.amcLogoUrl} />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="AMC" value={fund.amc} />
            <InfoRow label="Sector" value={fund.sector} />
            <InfoRow label="Category" value={fund.category} />
            <InfoRow label="Risk profile" value={fund.riskProfile ?? "—"} />
            <InfoRow label="Rating" value={fund.rating ?? "—"} />
            <InfoRow label="Benchmark" value={fund.benchmark ?? "—"} />
            <InfoRow label="Offer price" value={formatNumber(fund.offerPrice, 4)} />
            {(fund.amcEmail || fund.amcPhone || fund.amcUrl) && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
                {fund.amcEmail && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5 shrink-0" />
                    <span className="truncate">{fund.amcEmail}</span>
                  </span>
                )}
                {fund.amcPhone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" /> {fund.amcPhone}
                  </span>
                )}
                {fund.amcUrl && (
                  <a
                    href={normalizeUrl(fund.amcUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5 shrink-0" />
                    <span className="truncate">{fund.amcUrl}</span>
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="rose" variant="gradient"><Info /></IconChip>
            <CardTitle>Fund information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Fund code" value={fund.fundCode ?? "—"} />
            <InfoRow label="Inception" value={formatDate(fund.inceptionDate)} />
            <InfoRow label="Front-end load" value={formatLoad(fund.frontLoad)} />
            <InfoRow label="Back-end load" value={formatLoad(fund.backLoad)} />
            <InfoRow label="Contingent load" value={formatLoad(fund.contingentLoad)} />
            <InfoRow label="Dealing days" value={fund.dealingDays ?? "—"} />
            <InfoRow label="Pricing mechanism" value={fund.priceMechanism ?? "—"} />
            <InfoRow label="Trustee" value={fund.trusteeName ?? "—"} />
            <InfoRow label="Rating date" value={formatDate(fund.ratingDate)} />
            <InfoRow label="Leverage" value={fund.leverage ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="teal" variant="gradient"><Landmark /></IconChip>
            <CardTitle>Net assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow
              label="Net assets"
              value={fund.netAssets != null ? `${formatNumber(fund.netAssets, 2)} mn` : "—"}
            />
            <InfoRow
              label="Excl. FoFs"
              value={fund.netAssetsExFof != null ? `${formatNumber(fund.netAssetsExFof, 2)} mn` : "—"}
            />
            <InfoRow label="As of" value={formatDate(fund.detailDate)} />
            <p className="pt-1 text-xs text-muted-foreground">Amounts in PKR millions.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="amber" variant="gradient"><Percent /></IconChip>
            <CardTitle>Expense ratio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="TER (YTD)" value={formatPercentPlain(fund.terYtd)} />
            <InfoRow label="TER (MTD)" value={formatPercentPlain(fund.terMtd)} />
            <InfoRow label="Govt levies (YTD)" value={formatPercentPlain(fund.govLeviesYtd)} />
            <InfoRow label="Govt levies (MTD)" value={formatPercentPlain(fund.govLeviesMtd)} />
            <InfoRow label="Selling & marketing" value={formatPercentPlain(fund.sellingMarketingPct)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconChip accent="teal" variant="gradient"><PieChart /></IconChip>
            <CardTitle>Asset allocation</CardTitle>
          </div>
          {fund.detailDate && (
            <span className="text-xs text-muted-foreground">as of {formatDate(fund.detailDate)}</span>
          )}
        </CardHeader>
        <CardContent>
          {fund.assetAllocation.length ? (
            <div className="space-y-3">
              {fund.assetAllocation.map((item) => {
                const pct = item.percent ?? 0;
                const negative = (item.amount ?? pct) < 0;
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{item.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatNumber(item.amount, 2)} mn · {formatPercentPlain(item.percent)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          negative
                            ? "bg-gradient-to-r from-rose-500 to-rose-400"
                            : "bg-gradient-to-r from-primary to-chart-2"
                        )}
                        style={{ width: `${Math.max(2, Math.min(100, Math.abs(pct)))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              MUFAP has not published asset allocation for this fund in the current detail response.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stock holdings from admin-managed data */}
      <FundHoldingsSection fundName={fund.name} />
    </div>
  );
}

function toneOf(value: number | null): "gain" | "loss" | "default" {
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

function normalizeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function Return({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-semibold tabular-nums", plColorClass(value))}>
        {formatPercent(value)}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
