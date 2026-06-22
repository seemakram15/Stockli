import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getWatchlistSymbols, getTickerMap } from "@/lib/services/portfolio";
import { getQuotes } from "@/lib/services/prices";
import { isDemoMode } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { WatchlistTable, type WatchItem } from "@/components/watchlist/watchlist-table";
import { DataDelayBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Watchlist" };
export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const symbols = await getWatchlistSymbols();
  const [tickerMap, quoteMap] = await Promise.all([
    getTickerMap(symbols),
    getQuotes(symbols),
  ]);

  const items: WatchItem[] = symbols.map((s) => ({
    symbol: s,
    company: tickerMap.get(s.toUpperCase())?.company_name ?? null,
    sector: tickerMap.get(s.toUpperCase())?.sector ?? null,
  }));
  const initial = Array.from(quoteMap.values());

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Watchlist"
        description="Tickers you're following but don't own yet."
        actions={<DataDelayBadge />}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Star className="size-6" />}
          title="Your watchlist is empty"
          description="Open any stock and tap “Watch” to start following it here."
        />
      ) : (
        <Card>
          <CardContent className="px-0 sm:px-2">
            <WatchlistTable items={items} initial={initial} demo={isDemoMode} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
