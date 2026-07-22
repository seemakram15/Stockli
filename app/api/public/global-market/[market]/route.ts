import { NextResponse } from "next/server";
import { getGlobalMarketData, type MarketUniverse } from "@/lib/services/global-markets";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPPORTED = ["us", "india", "world", "commodities", "crypto", "oil"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ market: string }> }
) {
  const { market } = await params;
  if (!isSupported(market)) {
    return NextResponse.json({ error: "Unsupported market" }, { status: 404 });
  }

  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh(`global-market:${market}`);
  }

  const data = await getGlobalMarketData(market);
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, 60, true),
    }
  );
}

function isSupported(value: string): value is MarketUniverse {
  return (SUPPORTED as readonly string[]).includes(value);
}
