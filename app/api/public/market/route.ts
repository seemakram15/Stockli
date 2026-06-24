import { NextResponse } from "next/server";
import { getPublicMarketPageData } from "@/lib/services/public-market-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPublicMarketPageData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=900",
      },
    }
  );
}
