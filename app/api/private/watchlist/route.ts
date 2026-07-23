import { NextResponse } from "next/server";
import { getSessionUser, getWatchlistSymbols } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

/** GET /api/private/watchlist — symbols the signed-in user is following. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbols = await getWatchlistSymbols();
  return NextResponse.json(
    { data: { symbols } },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
