import { NextResponse } from "next/server";
import { getIndexDetail } from "@/lib/services/market";
import { normalizeSymbol } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/index/KSE100 — live detail + constituents for an index. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) return NextResponse.json({ error: "Unknown index" }, { status: 404 });
  const detail = await getIndexDetail(symbol);
  if (!detail) return NextResponse.json({ error: "Unknown index" }, { status: 404 });
  return NextResponse.json(detail, {
    headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=180" },
  });
}
