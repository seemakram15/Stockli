import { NextResponse } from "next/server";
import { getFundsHoldingStock } from "@/lib/services/fund-returns";
import { psxLiveCacheTtlSeconds } from "@/lib/psx/market-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const data = await getFundsHoldingStock(symbol);
  const ttl = psxLiveCacheTtlSeconds();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": `s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
      },
    }
  );
}
