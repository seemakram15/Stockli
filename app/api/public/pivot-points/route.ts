import { NextResponse } from "next/server";
import { psxClosedMaxStaleSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getPivotPointsData } from "@/lib/services/market-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("pivot-points");
  }
  const data = await getPivotPointsData();
  const isLiveWindow = shouldRefreshPsxData();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(
        fresh,
        isLiveWindow ? 60 : psxClosedMaxStaleSeconds(),
        isLiveWindow
      ),
    }
  );
}
