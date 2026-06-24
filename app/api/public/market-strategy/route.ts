import { NextResponse } from "next/server";
import { getMarketStrategyData } from "@/lib/services/market-strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMarketStrategyData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=900",
      },
    }
  );
}
