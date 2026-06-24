import { NextResponse } from "next/server";
import { getDashboardPageData } from "@/lib/services/dashboard-page";
import { getSessionUser } from "@/lib/services/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getDashboardPageData();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
