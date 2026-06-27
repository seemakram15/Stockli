import { NextResponse } from "next/server";
import {
  refreshStockFinancials,
  type StockFinancialsRefreshResult,
} from "@/lib/services/stock-fundamentals";
import { normalizeSymbol } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  try {
    const refreshed = await refreshStockFinancials(symbol);
    if (!refreshed) {
      return NextResponse.json({ error: "Financial data unavailable" }, { status: 404 });
    }

    const payload = buildRefreshPayload(symbol, refreshed);
    return NextResponse.json(
      payload,
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Fresh fundamentals could not be fetched.",
      },
      { status: 500 }
    );
  }
}

function buildRefreshPayload(symbol: string, refreshed: StockFinancialsRefreshResult) {
  const cacheStatus = refreshed.usedFallback ? "stale" : "fresh";
  const warning = refreshed.usedFallback
    ? `AskAnalyst did not return fresh statement rows for ${symbol}. The last cached snapshot was preserved.`
    : refreshed.hadMeaningfulFreshData
      ? null
      : `AskAnalyst returned only partial fundamentals for ${symbol}. Cached rows were kept where available.`;

  return {
    data: refreshed.value,
    refresh: {
      usedFallback: refreshed.usedFallback,
      hadMeaningfulFreshData: refreshed.hadMeaningfulFreshData,
    },
    cache: {
      status: cacheStatus,
      storedAt: refreshed.storedAt,
    },
    warning,
  };
}
