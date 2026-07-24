import { NextResponse } from "next/server";
import { isSuperadmin } from "@/lib/auth/roles";
import { getRedisMonitorSnapshot } from "@/lib/services/control-panel/upstash-monitor";
import { MonitorHttpError } from "@/lib/services/control-panel/monitor-http";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isSuperadmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const data = await getRedisMonitorSnapshot();
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof MonitorHttpError ? e.status : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load Redis metrics" },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
