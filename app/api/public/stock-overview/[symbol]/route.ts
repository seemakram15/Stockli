import { NextResponse } from "next/server";
import { getStockOverview } from "@/lib/services/stock-overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const data = await getStockOverview(symbol);
  if (!data) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=86400",
      },
    }
  );
}
