import "server-only";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { getMemoryCache, setMemoryCache } from "@/lib/cache/memory";
import { getRedis } from "@/lib/cache/redis";

type RateLimitBucket = {
  key: string;
  limit: number;
};

type MemoryCounter = {
  count: number;
  resetAt: number;
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function hashPart(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function normalizePart(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export async function getRequestClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const cfIp = headerStore.get("cf-connecting-ip")?.trim();
  const fallback =
    headerStore.get("user-agent")?.trim() ||
    headerStore.get("accept-language")?.trim() ||
    "unknown";

  return cfIp || forwardedFor || realIp || `ua:${hashPart(fallback)}`;
}

export async function enforceRateLimit({
  scope,
  windowSeconds,
  buckets,
}: {
  scope: string;
  windowSeconds: number;
  buckets: RateLimitBucket[];
}): Promise<RateLimitResult> {
  const usableBuckets = buckets.filter((bucket) => bucket.key.trim().length > 0);
  if (usableBuckets.length === 0) return { allowed: true, retryAfterSeconds: 0 };

  let maxRetryAfterSeconds = 0;
  for (const bucket of usableBuckets) {
    const result = await incrementBucket({
      scope,
      bucket,
      windowSeconds,
    });
    if (!result.allowed) {
      maxRetryAfterSeconds = Math.max(maxRetryAfterSeconds, result.retryAfterSeconds);
    }
  }

  return {
    allowed: maxRetryAfterSeconds === 0,
    retryAfterSeconds: maxRetryAfterSeconds,
  };
}

export function formatRetryAfter(seconds: number) {
  const wholeSeconds = Math.max(1, Math.ceil(seconds));
  if (wholeSeconds < 60) {
    return `${wholeSeconds} second${wholeSeconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.ceil(wholeSeconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function rateLimitKeyPart(value: string | null | undefined) {
  return hashPart(normalizePart(value) || "unknown");
}

async function incrementBucket({
  scope,
  bucket,
  windowSeconds,
}: {
  scope: string;
  bucket: RateLimitBucket;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const key = `rate-limit:${scope}:${bucket.limit}:${windowSeconds}:${bucket.key}`;
  const redis = getRedis();

  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > bucket.limit) {
        const ttl = await redis.ttl(key);
        return {
          allowed: false,
          retryAfterSeconds: typeof ttl === "number" && ttl > 0 ? ttl : windowSeconds,
        };
      }

      return { allowed: true, retryAfterSeconds: 0 };
    } catch {
      // Fall back to in-memory counters on transient Redis errors.
    }
  }

  const now = Date.now();
  const existing = getMemoryCache<MemoryCounter>(key);
  if (!existing) {
    setMemoryCache(
      key,
      {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      },
      windowSeconds
    );
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const nextCount = existing.count + 1;
  setMemoryCache(
    key,
    {
      count: nextCount,
      resetAt: existing.resetAt,
    },
    Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  );

  if (nextCount > bucket.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
