import { NextResponse } from "next/server";
import { getNotifications } from "@/lib/services/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/notifications — recent notifications + unread count for the user. */
export async function GET() {
  const feed = await getNotifications();
  return NextResponse.json(feed);
}
