import type { Metadata } from "next";
import { ExternalLink, Target } from "lucide-react";
import { getMarketStrategyData } from "@/lib/services/market-strategy";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataDelayBadge } from "@/components/status-badges";
import { MarketStrategyBoard } from "@/components/market/market-strategy-board";
import {
  formatDateTime,
  formatNumber,
  formatPKR,
  formatSigned,
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
            <span className={cn("tabular-nums", plColorClass(index.change))}>
              {formatSigned(index.change, 2)}
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

      <MarketStrategyBoard data={data} />
    </div>
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
