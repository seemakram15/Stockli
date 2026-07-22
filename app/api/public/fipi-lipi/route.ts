import { NextResponse } from "next/server";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getFipiLipiData } from "@/lib/services/fipi-lipi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("fipi-lipi");
  }
  const data = await getFipiLipiData();
  return NextResponse.json(
    { data },
    { headers: freshCacheHeaders(fresh, 1800, false) }
  );
}
