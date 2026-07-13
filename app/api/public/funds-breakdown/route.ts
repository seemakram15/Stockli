import { NextResponse } from "next/server";
import { getFundsBreakdownData } from "@/lib/services/funds-breakdown";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getFundsBreakdownData();
  const ttl = psxLiveCacheTtlSeconds();
  return NextResponse.json({ data }, {
    headers: {
      "Cache-Control": shouldRefreshPsxData()
        ? "s-maxage=60, stale-while-revalidate=900"
        : `s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
    },
  });
}
