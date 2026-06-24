import { NextResponse } from "next/server";
import { getPortfoliosPageData } from "@/lib/services/portfolios-page";
import { getSessionUser } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getPortfoliosPageData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
