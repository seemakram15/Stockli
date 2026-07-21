import { NextResponse } from "next/server";
import { getPakistanFuelPrices } from "@/lib/services/pakistan-fuel-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getPakistanFuelPrices();
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "s-maxage=21600, stale-while-revalidate=604800" } }
  );
}
