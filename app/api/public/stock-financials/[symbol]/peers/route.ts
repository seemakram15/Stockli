import { NextResponse } from "next/server";
import { getStockFinancialPeerComparison } from "@/lib/services/stock-fundamentals";
import { normalizeSymbol } from "@/lib/security/validation";
import type { StockFinancialTabId } from "@/lib/types/stock-fundamentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PEER_TABS = ["latest", "income", "balance", "cashflow", "ratios"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const tabId = searchParams.get("tab") as StockFinancialTabId | null;
  const metric = searchParams.get("metric")?.trim();

  if (!tabId || !PEER_TABS.includes(tabId as (typeof PEER_TABS)[number]) || !metric) {
    return NextResponse.json({ error: "Invalid peer comparison request" }, { status: 400 });
  }

  const cached = await getStockFinancialPeerComparison({ symbol, tabId, metricLabel: metric });
  if (!cached) {
    return NextResponse.json({ error: "Peer comparison unavailable" }, { status: 404 });
  }

  return NextResponse.json(
    {
      data: cached.value,
      cache: {
        status: cached.status,
        storedAt: cached.storedAt,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    }
  );
}
