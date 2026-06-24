import { NextResponse } from "next/server";
import { getYoutubeVideos } from "@/lib/services/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getYoutubeVideos();
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=1800",
      },
    }
  );
}
