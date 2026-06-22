import type { Metadata } from "next";
import { getMarketRows } from "@/lib/services/prices";
import { getIndices, getSectorBreakdown } from "@/lib/services/market";
import { getTickerMap } from "@/lib/services/portfolio";
import { marketStatus } from "@/lib/psx/market-hours";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { MarketTable, type MarketRow } from "@/components/market/market-table";
import { IndicesPanel } from "@/components/market/indices-panel";
import { MarketStatusBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Market" };
export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const [indices, sectorData, watch] = await Promise.all([
    getIndices(),
    getSectorBreakdown(),
    getMarketRows(),
  ]);
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

  const market = marketStatus();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Market"
        description="PSX indices, sector performance and every listing."
        actions={<MarketStatusBadge status={market.status} label={market.label} />}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Market Overview</h2>
        <IndicesPanel indices={indices} sectors={sectorData.sectors} breadth={sectorData.breadth} />
      </section>

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
