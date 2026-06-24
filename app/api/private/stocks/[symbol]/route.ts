import { NextResponse } from "next/server";
import { getStockPageData } from "@/lib/services/stock-page";
import { getSessionUser } from "@/lib/services/portfolio";
import { normalizeSymbol } from "@/lib/security/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { symbol: rawSymbol } = await params;
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const data = await getStockPageData(symbol);
  if (!data) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
