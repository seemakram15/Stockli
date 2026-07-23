import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";

let _redis: Redis | null = null;

function getEdgeRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export interface EdgeRateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

/**
 * Fixed-window rate limiter for Edge/middleware.
 * Uses Upstash Redis directly (no "server-only" import).
 * Silently allows requests when Redis is unavailable.
 */
export async function edgeRateLimit(
  req: NextRequest,
  scope: string,
  limit: number,
  windowSeconds: number
): Promise<EdgeRateLimitResult> {
  const redis = getEdgeRedis();
  if (!redis) return { allowed: true, retryAfter: 0 };

  const ip = clientIp(req);
  // Include limit + window so raising quotas doesn't inherit a saturated older key.
  const key = `rl:${scope}:${limit}:${windowSeconds}:${simpleHash(ip)}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSeconds);

    if (count > limit) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        retryAfter: typeof ttl === "number" && ttl > 0 ? ttl : windowSeconds,
      };
    }

    return { allowed: true, retryAfter: 0 };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}
