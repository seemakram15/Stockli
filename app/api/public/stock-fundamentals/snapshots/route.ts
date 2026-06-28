import { NextResponse } from "next/server";
import { getArchivedStockFinancialsBatch } from "@/lib/services/stock-fundamentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = parsePositiveInt(searchParams.get("offset"), 0);
  const limit = parsePositiveInt(searchParams.get("limit"), 25);
  const batch = await getArchivedStockFinancialsBatch({ offset, limit });

  return NextResponse.json(
    { data: batch },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    }
  );
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
