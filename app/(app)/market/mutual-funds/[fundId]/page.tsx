import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getMufapFundById } from "@/lib/services/mufap";
import { PageHeader } from "@/components/page-header";
import { SmartBackLink } from "@/components/smart-back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AmcBrandMark } from "@/components/market/amc-brand-mark";
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
        <Metric label="NAV" value={formatNumber(fund.nav, 4)} />
        <Metric label="1 day" value={formatPercent(fund.d1)} tone={fund.d1} />
        <Metric label="MTD" value={formatPercent(fund.mtd)} tone={fund.mtd} />
        <Metric label="Rs 100k P/L" value={formatPKR(fund.profitOn100k, { sign: true })} tone={fund.profitOn100k} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
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
          <CardHeader>
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

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number | null;
}) {
  return (
    <Card>
      <CardContent className="min-w-0 p-3 sm:p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-lg font-bold tabular-nums [overflow-wrap:anywhere] sm:text-2xl", plColorClass(tone))}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
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
