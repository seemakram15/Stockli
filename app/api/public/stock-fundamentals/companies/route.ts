import { NextResponse } from "next/server";
import { getStockFundamentalsCompanies } from "@/lib/services/stock-fundamentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const companies = await getStockFundamentalsCompanies();

  return NextResponse.json(
    { data: { companies } },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
