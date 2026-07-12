import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BadgePercent,
  BarChart3,
  CalendarClock,
  Coins,
  ExternalLink,
  LineChart,
  PieChart,
  Wallet,
} from "lucide-react";
import { getMufapFundById } from "@/lib/services/mufap";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { IconChip } from "@/components/ui/accent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
import { FundHoldingsSection } from "@/components/market/fund-holdings-section";
import {
  formatNumber,
  formatPercent,
  formatPKR,
  plColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fund profile" };

export default async function MutualFundDetailPage({
  params,
}: {
  params: Promise<{ fundId: string }>;
}) {
  const { fundId } = await params;
  const fund = await getMufapFundById(fundId);
  if (!fund) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SmartBackLink fallbackHref="/market/mutual-funds" label="Back to funds" />

      <PageHeader
        icon={<BadgePercent />}
        eyebrow="Fund profile"
        accent="amber"
        title={fund.name}
        description={`${fund.amc} · ${fund.type}`}
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
        <StatCard label="NAV" value={formatNumber(fund.nav, 4)} accent="amber" icon={<Coins className="size-4" />} />
        <StatCard label="1 day" value={formatPercent(fund.d1)} tone={toneOf(fund.d1)} accent="sky" icon={<CalendarClock className="size-4" />} />
        <StatCard label="MTD" value={formatPercent(fund.mtd)} tone={toneOf(fund.mtd)} accent="violet" icon={<LineChart className="size-4" />} />
        <StatCard label="Rs 100k P/L" value={formatPKR(fund.profitOn100k, { sign: true })} tone={toneOf(fund.profitOn100k)} accent="emerald" icon={<Wallet className="size-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="violet" variant="gradient"><LineChart /></IconChip>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Return label="YTD" value={fund.ytd} />
            <Return label="15 days" value={fund.d15} />
            <Return label="30 days" value={fund.d30} />
            <Return label="90 days" value={fund.d90} />
            <Return label="180 days" value={fund.d180} />
            <Return label="270 days" value={fund.d270} />
            <Return label="365 days" value={fund.d365} />
            <Return label="3 years" value={fund.y3} />
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
            <Info label="AMC" value={fund.amc} />
            <Info label="Sector" value={fund.sector} />
            <Info label="Category" value={fund.category} />
            <Info label="Risk" value={fund.riskProfile ?? "—"} />
            <Info label="Rating" value={fund.rating ?? "—"} />
            <Info label="Benchmark" value={fund.benchmark ?? "—"} />
            <Info label="Validity" value={fund.validityDate ?? "—"} />
            <Info label="Offer price" value={formatNumber(fund.offerPrice, 4)} />
          </CardContent>
        </Card>
      </div>

      {/* Stock holdings from admin-managed data */}
      <FundHoldingsSection fundName={fund.name} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="teal" variant="gradient"><PieChart /></IconChip>
            <CardTitle>Asset allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fund.assetAllocation.length ? (
              fund.assetAllocation.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <span className="font-medium">{item.label}</span>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatPercent(item.percent)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(item.amount, 2)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                MUFAP has not published asset allocation for this fund in the current detail response.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-3">
            <IconChip accent="sky" variant="gradient"><BarChart3 /></IconChip>
            <CardTitle>Holdings / stocks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fund.holdingsNote ? (
              <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {fund.holdingsNote}
              </p>
            ) : null}
            {fund.topHoldings.length ? (
              fund.topHoldings.map((holding) => (
                <div
                  key={`${holding.name}-${holding.percent}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-background p-3"
                >
                  <div>
                    <p className="font-medium">{holding.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {holding.readableName ? "Stock holding" : "Official MUFAP row"}
                      {holding.date ? ` · ${holding.date.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatPercent(holding.percent)}</p>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                MUFAP has not published top stock holdings for this fund in the current detail response.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function toneOf(value: number | null): "gain" | "loss" | "default" {
  if (value == null || Number.isNaN(value)) return "default";
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "default";
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
