import { NextResponse } from "next/server";
import { getBoardMeetingsData } from "@/lib/services/market-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBoardMeetingsData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=86400",
      },
    }
  );
}
