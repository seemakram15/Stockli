import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import {
  refreshStockFinancials,
  type StockFinancialsRefreshResult,
} from "@/lib/services/stock-fundamentals";
import { normalizeSymbol } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  if (!isDemoMode) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

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
  } catch (_error) {
    return NextResponse.json(
      {
        error: "Fresh fundamentals could not be fetched.",
      },
      { status: 500 }
    );
  }
}

function buildRefreshPayload(symbol: string, refreshed: StockFinancialsRefreshResult) {
  const cacheStatus = refreshed.usedFallback ? "stale" : "fresh";
  const warning = refreshed.usedFallback
    ? `Fresh statement rows were not available for ${symbol}. The last cached snapshot was preserved.`
    : refreshed.complete
      ? null
      : `Complete fundamentals are not available for ${symbol} yet. Missing sections: ${refreshed.missingTabs.join(", ")}.`;

  return {
    data: refreshed.value,
    refresh: {
      usedFallback: refreshed.usedFallback,
      hadMeaningfulFreshData: refreshed.hadMeaningfulFreshData,
      complete: refreshed.complete,
      missingTabs: refreshed.missingTabs,
    },
    cache: {
      status: cacheStatus,
      storedAt: refreshed.storedAt,
    },
    warning,
  };
}
