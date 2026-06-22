import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Target } from "lucide-react";
import { getMarketStrategyData, type StrategyFundRow } from "@/lib/services/market-strategy";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataDelayBadge } from "@/components/status-badges";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  formatPKR,
  plColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Market Strategy" };
export const dynamic = "force-dynamic";

export default async function MarketStrategyPage() {
  const data = await getMarketStrategyData();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Target className="size-7 text-primary" />
            Market Strategy
          </span>
        }
        description={`Estimated fund returns per ${formatPKR(data.investmentAmount)} from MUFAP daily performance.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <DataDelayBadge />
            <Button asChild variant="outline">
              <a href={data.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                MUFAP source
              </a>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {data.indexBadges.map((index) => (
          <span
            key={index.symbol}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium shadow-sm"
          >
            <span className="text-muted-foreground">{index.symbol}</span>{" "}
            <span className="tabular-nums">{formatNumber(index.current, 0)}</span>{" "}
            <span className={cn("tabular-nums", plColorClass(index.changePct))}>
              {formatPercent(index.changePct)}
            </span>
          </span>
        ))}
        <span className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm text-muted-foreground">
          Updated {formatDateTime(data.updatedAt)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Average estimate" value={formatPKR(data.summary.avgEstimatedReturn, { sign: true })} tone={data.summary.avgEstimatedReturn} />
        <Metric label="Positive funds" value={String(data.summary.positiveCount)} tone={1} />
        <Metric label="Negative funds" value={String(data.summary.negativeCount)} tone={-1} />
        <Metric
          label="Best fund"
          value={data.summary.best ? formatPKR(data.summary.best.estimatedReturn, { sign: true }) : "—"}
          tone={data.summary.best?.estimatedReturn}
          caption={data.summary.best?.name}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle>Estimated fund returns</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-2">
            <StrategyColumn title="Islamic funds" rows={data.islamic} />
            <StrategyColumn title="Conventional funds" rows={data.conventional} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StrategyColumn({ title, rows }: { title: string; rows: StrategyFundRow[] }) {
  return (
    <section className="border-b border-border lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div
            key={`${row.fundId ?? row.name}-${row.classFilter}`}
            className={cn("grid grid-cols-[1fr_auto] gap-4 px-4 py-2.5", rowTint(row.estimatedReturn))}
          >
            <div className="min-w-0">
              {row.fundId ? (
                <Link href={`/market/mutual-funds/${row.fundId}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
              ) : (
                <p className="font-medium">{row.name}</p>
              )}
              <p className="truncate text-xs opacity-80">
                {row.amc} · {row.type} · {formatPercent(row.returnPct)}
              </p>
            </div>
            <p className="font-bold tabular-nums">
              {formatPKR(row.estimatedReturn, { sign: true })}
            </p>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="px-4 py-8 text-sm text-muted-foreground">No stock funds are available in this class.</p>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone?: number | null;
  caption?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-2xl font-bold tabular-nums", plColorClass(tone))}>
          {value}
        </p>
        {caption ? <p className="mt-1 truncate text-xs text-muted-foreground">{caption}</p> : null}
      </CardContent>
    </Card>
  );
}

function rowTint(value: number | null) {
  if (value == null) return "bg-muted/20";
  if (value >= 300) return "bg-emerald-600 text-white";
  if (value >= 0) return "bg-emerald-100 text-emerald-950";
  if (value <= -300) return "bg-red-600 text-white";
  if (value <= -100) return "bg-amber-100 text-amber-950";
  return "bg-sky-100 text-sky-950";
}
