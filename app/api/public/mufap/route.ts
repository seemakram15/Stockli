import { NextResponse } from "next/server";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getMufapFunds } from "@/lib/services/mufap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeEtfs = searchParams.get("kind") === "etfs";
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh(includeEtfs ? "mufap-etfs" : "mufap-mutual");
  }
  const data = await getMufapFunds({ includeEtfs });
  const ttl = psxLiveCacheTtlSeconds();

  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, ttl, shouldRefreshPsxData()),
    }
  );
}
