import { NextResponse } from "next/server";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getHoldingsStrategyData } from "@/lib/services/market-strategy-holdings";
import { FUND_INVESTMENT_AMOUNT } from "@/lib/services/fund-return-estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const fresh = wantsFresh(request);
    let warnings: string[] = [];
    if (fresh) {
      const refresh = await forcePublicRefresh("market-strategy-holdings");
      warnings = refresh.warnings;
    }
    const data = await getHoldingsStrategyData();
    const ttl = psxLiveCacheTtlSeconds();
    return NextResponse.json(
      { data, ...(warnings.length ? { warnings } : {}) },
      {
        headers: freshCacheHeaders(fresh, ttl, shouldRefreshPsxData()),
      }
    );
  } catch (error) {
    console.error("[market-strategy-holdings] GET failed:", error);
    return NextResponse.json(
      {
        data: {
          funds: [],
          periodYear: 0,
          periodMonth: 0,
          updatedAt: new Date().toISOString(),
          investmentAmount: FUND_INVESTMENT_AMOUNT,
          summary: {
            totalFunds: 0,
            positiveCount: 0,
            negativeCount: 0,
            avgEstimatedReturn: 0,
            best: null,
            worst: null,
          },
        },
        warning: error instanceof Error ? error.message : String(error),
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
