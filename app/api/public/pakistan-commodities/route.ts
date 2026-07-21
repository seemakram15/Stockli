import { NextResponse } from "next/server";
import { getPakistanCommodities } from "@/lib/services/pakistan-commodities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPakistanCommodities();
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=43200" } }
  );
}
