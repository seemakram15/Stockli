import { NextResponse } from "next/server";
import { getFundsBreakdownData } from "@/lib/services/funds-breakdown";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const fresh = wantsFresh(request);
    let warnings: string[] = [];
    if (fresh) {
      const refresh = await forcePublicRefresh("funds-breakdown");
      warnings = refresh.warnings;
    }
    const data = await getFundsBreakdownData();
    const ttl = psxLiveCacheTtlSeconds();
    return NextResponse.json(
      { data, ...(warnings.length ? { warnings } : {}) },
      {
        headers: freshCacheHeaders(fresh, ttl, shouldRefreshPsxData()),
      }
    );
  } catch (error) {
    console.error("[funds-breakdown] GET failed:", error);
    return NextResponse.json(
      {
        data: {
          funds: [],
          periodYear: 0,
          periodMonth: 0,
          updatedAt: new Date().toISOString(),
        },
        warning: error instanceof Error ? error.message : String(error),
      },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
