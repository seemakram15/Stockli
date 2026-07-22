import { NextResponse } from "next/server";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getPakistanFuelPrices } from "@/lib/services/pakistan-fuel-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("pk-fuel");
  }

  const data = await getPakistanFuelPrices();
  return NextResponse.json(
    { data },
    { headers: freshCacheHeaders(fresh, 6 * 60 * 60, false) }
  );
}
