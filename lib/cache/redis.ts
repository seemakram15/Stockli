import "server-only";

import { Redis } from "@upstash/redis";
import { config, isUpstashConfigured, isUpstashFallbackConfigured } from "@/lib/config";

/**
 * Upstash Redis (HTTP, serverless-friendly). Returns null when not configured
 * so callers degrade to "no cache" (always fetch) rather than crashing.
 */
let _redis: Redis | null = null;
let _fallbackRedis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!isUpstashConfigured) return null;
  if (!_redis) {
    _redis = new Redis({
      url: config.upstash.url,
      token: config.upstash.token,
    });
  }
  return _redis;
}

export function getRedisFallback(): Redis | null {
  if (!isUpstashFallbackConfigured) return null;
  if (!_fallbackRedis) {
    _fallbackRedis = new Redis({
      url: config.upstashFallback.url,
      token: config.upstashFallback.token,
    });
  }
  return _fallbackRedis;
}

export function getRedisClients(): Redis[] {
  return [getRedis(), getRedisFallback()].filter(Boolean) as Redis[];
}
