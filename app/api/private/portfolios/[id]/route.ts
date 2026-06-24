import { NextResponse } from "next/server";
import { getPortfolioPageData } from "@/lib/services/portfolio-page";
import { getSessionUser } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const data = await getPortfolioPageData(id);
  if (!data) {
    return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
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
