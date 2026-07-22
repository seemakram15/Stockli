import { NextResponse } from "next/server";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getPakistanCommodities } from "@/lib/services/pakistan-commodities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("pk-commodities");
  }

  const data = await getPakistanCommodities();
  return NextResponse.json(
    { data },
    { headers: freshCacheHeaders(fresh, 90, true) }
  );
}
