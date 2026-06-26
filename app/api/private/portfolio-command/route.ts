import { NextResponse } from "next/server";
import { getPortfolioCommandPageData } from "@/lib/services/portfolio-command-page";
import { getSessionUser } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getPortfolioCommandPageData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
