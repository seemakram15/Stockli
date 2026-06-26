import { NextResponse } from "next/server";
import { getUsefulLinksData } from "@/lib/services/market-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getUsefulLinksData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
