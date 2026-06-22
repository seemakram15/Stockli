import { NextResponse } from "next/server";
import { getIndexDetail } from "@/lib/services/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/index/KSE100 — live detail + constituents for an index. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;
  const detail = await getIndexDetail(symbol);
  if (!detail) return NextResponse.json({ error: "Unknown index" }, { status: 404 });
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=180" },
  });
}
