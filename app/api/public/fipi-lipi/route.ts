import { NextResponse } from "next/server";
import { getFipiLipiData } from "@/lib/services/fipi-lipi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getFipiLipiData();
  // NCCPL publishes once a day after close, so a long shared cache is fine.
  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=86400" } }
  );
}
