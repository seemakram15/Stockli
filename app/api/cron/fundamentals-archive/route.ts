import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { getRedisClients } from "@/lib/cache/redis";
import { archiveStockFundamentals } from "@/lib/services/stock-fundamentals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ARCHIVE_CURSOR_KEY = "stock-fundamentals:archive-cursor:v1";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const useCursor = searchParams.get("cursor") === "auto";
  const offset = useCursor ? await readArchiveCursor() : parsePositiveInt(searchParams.get("offset"), 0);
  const limit = parsePositiveInt(searchParams.get("limit"), 25);
  const symbols = searchParams
    .get("symbols")
    ?.split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  const result = await archiveStockFundamentals({
    offset,
    limit,
    symbols,
  });

  if (useCursor) {
    await writeArchiveCursor(result.nextOffset ?? 0);
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

async function readArchiveCursor() {
  for (const redis of getRedisClients()) {
    try {
      const value = await redis.get<number | string>(ARCHIVE_CURSOR_KEY);
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return Math.floor(parsed);
    } catch (error) {
      console.warn("[fundamentals-archive] cursor read failed:", error);
    }
  }
  return 0;
}

async function writeArchiveCursor(offset: number) {
  await Promise.allSettled(getRedisClients().map((redis) => redis.set(ARCHIVE_CURSOR_KEY, offset)));
}
