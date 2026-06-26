import { NextResponse } from "next/server";
import { getBookClosuresData } from "@/lib/services/market-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBookClosuresData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=86400",
      },
    }
  );
}
