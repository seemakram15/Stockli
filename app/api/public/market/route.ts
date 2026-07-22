import { NextResponse } from "next/server";
import { invalidateStaleCache } from "@/lib/cache/stale";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { freshCacheHeaders, wantsFresh } from "@/lib/services/force-public-refresh";
import { refreshIndexSummaries } from "@/lib/services/history";
import { forceRefreshMarketWatch } from "@/lib/services/prices";
import { getPublicMarketPageData } from "@/lib/services/public-market-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    try {
      await forceRefreshMarketWatch();
      await refreshIndexSummaries();
    } catch (error) {
      console.warn("[public/market] forced PSX refresh failed:", error);
    }
    await invalidateStaleCache("public-page:psx-market:v3");
  }

  const data = await getPublicMarketPageData();
  const ttl = psxLiveCacheTtlSeconds();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, ttl, shouldRefreshPsxData()),
    }
  );
}
