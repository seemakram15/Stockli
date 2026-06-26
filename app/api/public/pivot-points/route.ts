import { NextResponse } from "next/server";
import { psxClosedMaxStaleSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { getPivotPointsData } from "@/lib/services/market-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPivotPointsData();
  const isLiveWindow = shouldRefreshPsxData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": isLiveWindow
          ? "s-maxage=60, stale-while-revalidate=900"
          : `s-maxage=${psxClosedMaxStaleSeconds()}, stale-while-revalidate=${psxClosedMaxStaleSeconds()}`,
      },
    }
  );
}
