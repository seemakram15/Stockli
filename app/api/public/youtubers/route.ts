import { NextResponse } from "next/server";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getYoutubeVideos } from "@/lib/services/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("youtubers");
  }
  const data = await getYoutubeVideos();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, 300, false),
    }
  );
}
