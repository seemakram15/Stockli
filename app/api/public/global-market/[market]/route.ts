import { NextResponse } from "next/server";
import { getGlobalMarketData, type MarketUniverse } from "@/lib/services/global-markets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED = ["us", "india", "world", "commodities", "crypto", "oil"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ market: string }> }
) {
  const { market } = await params;
  if (!isSupported(market)) {
    return NextResponse.json({ error: "Unsupported market" }, { status: 404 });
  }

  const data = await getGlobalMarketData(market);
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=900",
      },
    }
  );
}

function isSupported(value: string): value is MarketUniverse {
  return (SUPPORTED as readonly string[]).includes(value);
}
