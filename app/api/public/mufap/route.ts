import { NextResponse } from "next/server";
import { getMufapFunds } from "@/lib/services/mufap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeEtfs = searchParams.get("kind") === "etfs";
  const data = await getMufapFunds({ includeEtfs });

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=900",
      },
    }
  );
}
