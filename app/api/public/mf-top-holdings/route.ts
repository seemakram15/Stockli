import { NextResponse } from "next/server";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getMFTopHoldingsData } from "@/lib/services/mf-top-holdings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("mf-top-holdings");
  }
  const data = await getMFTopHoldingsData();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, 300, false),
    }
  );
}
