import { Redis } from "@upstash/redis";
import { config, isUpstashConfigured } from "@/lib/config";

/**
 * Upstash Redis (HTTP, serverless-friendly). Returns null when not configured
 * so callers degrade to "no cache" (always fetch) rather than crashing.
 */
let _redis: Redis | null = null;

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
