import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { psx } from "@/lib/psx/adapter";
import { getTickerMap } from "@/lib/services/portfolio";
import { marketStatus } from "@/lib/psx/market-hours";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MarketTable, type MarketRow } from "@/components/market/market-table";
import { ChangeBadge } from "@/components/change-badge";
import { MarketStatusBadge, DataDelayBadge } from "@/components/status-badges";
import { formatPKR } from "@/lib/format";

export const metadata: Metadata = { title: "Market" };
export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const watch = await psx.getMarketWatch();
  const tickerMap = await getTickerMap(watch.map((w) => w.symbol));

  const rows: MarketRow[] = watch.map((w) => ({
    symbol: w.symbol,
    company: tickerMap.get(w.symbol)?.company_name ?? null,
    sector: w.sector ?? tickerMap.get(w.symbol)?.sector ?? null,
    price: w.current,
    change: w.change,
    changePct: w.changePct,
    volume: w.volume,
  }));

  const sorted = [...rows].sort((a, b) => b.changePct - a.changePct);
  const gainers = sorted.slice(0, 5);
  const losers = sorted.slice(-5).reverse();
  const advances = rows.filter((r) => r.changePct > 0).length;
  const declines = rows.filter((r) => r.changePct < 0).length;
  const market = marketStatus();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Market"
        description="Live-ish snapshot of PSX listings."
        actions={
          <div className="flex items-center gap-2">
            <MarketStatusBadge status={market.status} label={market.label} />
            <DataDelayBadge />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <Activity className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Breadth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gain">{advances} advancing</span>
              <span className="text-loss">{declines} declining</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-gain"
                style={{ width: `${(advances / Math.max(1, advances + declines)) * 100}%` }}
              />
              <div
                className="bg-loss"
                style={{ width: `${(declines / Math.max(1, advances + declines)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <MoverCard title="Top gainers" icon="up" rows={gainers} />
        <MoverCard title="Top losers" icon="down" rows={losers} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All listings</CardTitle>
        </CardHeader>
        <CardContent>
          <MarketTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function MoverCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: "up" | "down";
  rows: MarketRow[];
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-2">
        {icon === "up" ? (
          <TrendingUp className="size-4 text-gain" />
        ) : (
          <TrendingDown className="size-4 text-loss" />
        )}
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r) => (
          <Link
            key={r.symbol}
            href={`/stock/${r.symbol}`}
            className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent/50"
          >
            <span className="font-medium">{r.symbol}</span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums text-muted-foreground">{formatPKR(r.price)}</span>
              <ChangeBadge pct={r.changePct} />
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
