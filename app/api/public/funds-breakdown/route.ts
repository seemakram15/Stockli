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
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("funds-breakdown");
  }
  const data = await getFundsBreakdownData();
  const ttl = psxLiveCacheTtlSeconds();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, ttl, shouldRefreshPsxData()),
    }
  );
}
