import { NextResponse } from "next/server";
import { getUnreadCount } from "@/lib/services/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/notifications/unread — lightweight unread badge count only. */
export async function GET() {
  const unread = await getUnreadCount();
  return NextResponse.json({ unread }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
