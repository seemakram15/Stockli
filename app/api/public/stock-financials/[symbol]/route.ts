import { NextResponse } from "next/server";
import { getStockFinancials } from "@/lib/services/stock-fundamentals";
import { normalizeSymbol } from "@/lib/security/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const cached = await getStockFinancials(symbol);
  if (!cached) {
    return NextResponse.json({ error: "Financial data unavailable" }, { status: 404 });
  }

  return NextResponse.json(
    {
      data: cached.value,
      cache: {
        status: cached.status,
        storedAt: cached.storedAt,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    }
  );
}
