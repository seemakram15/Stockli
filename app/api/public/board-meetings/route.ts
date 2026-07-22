import { NextResponse } from "next/server";
import {
  forcePublicRefresh,
  freshCacheHeaders,
  wantsFresh,
} from "@/lib/services/force-public-refresh";
import { getBoardMeetingsData } from "@/lib/services/market-resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const fresh = wantsFresh(request);
  if (fresh) {
    await forcePublicRefresh("board-meetings");
  }
  const data = await getBoardMeetingsData();
  return NextResponse.json(
    { data },
    {
      headers: freshCacheHeaders(fresh, 1800, false),
    }
  );
}
