import { NextResponse } from "next/server";
import { getMFTopHoldingsData } from "@/lib/services/mf-top-holdings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMFTopHoldingsData();
  return NextResponse.json({ data }, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=1800" },
  });
}
