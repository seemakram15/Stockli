import { NextResponse } from "next/server";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getMarketStrategyData } from "@/lib/services/market-strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("market-strategy");
  }
  const data = await getMarketStrategyData();
  const ttl = psxLiveCacheTtlSeconds();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, ttl, shouldRefreshPsxData()),
    }
  );
}
