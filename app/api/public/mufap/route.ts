import { NextResponse } from "next/server";
import { psxLiveCacheTtlSeconds, shouldRefreshPsxData } from "@/lib/psx/market-hours";
import { getMufapFunds } from "@/lib/services/mufap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeEtfs = searchParams.get("kind") === "etfs";
  const data = await getMufapFunds({ includeEtfs });
  const ttl = psxLiveCacheTtlSeconds();

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": shouldRefreshPsxData()
          ? "s-maxage=60, stale-while-revalidate=900"
          : `s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
      },
    }
  );
}
