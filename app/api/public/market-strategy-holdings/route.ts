import { NextResponse } from "next/server";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getHoldingsStrategyData } from "@/lib/services/market-strategy-holdings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("market-strategy-holdings");
  }
  const data = await getHoldingsStrategyData();
  const ttl = psxLiveCacheTtlSeconds();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, ttl, shouldRefreshPsxData()),
    }
  );
}
