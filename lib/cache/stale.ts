import "server-only";
import { getMemoryCache, setMemoryCache } from "@/lib/cache/memory";
import { getRedis } from "@/lib/cache/redis";

type CacheStatus = "fresh" | "stale" | "miss";

type Envelope<T> = {
  value: T;
  storedAt: string;
  freshUntil: number;
  staleUntil: number;
};

type StaleCacheOptions<T> = {
  key: string;
  ttlSeconds: number;
  staleSeconds: number;
  load: () => Promise<T>;
  isUsable?: (value: T) => boolean;
};

const IN_FLIGHT_KEY = "__stockli_stale_cache_inflight__";

function inFlightStore(): Map<string, Promise<unknown>> {
  const root = globalThis as typeof globalThis & { [IN_FLIGHT_KEY]?: Map<string, Promise<unknown>> };
  if (!root[IN_FLIGHT_KEY]) root[IN_FLIGHT_KEY] = new Map();
  return root[IN_FLIGHT_KEY];
}

export async function getStaleCached<T>({
  key,
  ttlSeconds,
  staleSeconds,
  load,
  isUsable = Boolean,
}: StaleCacheOptions<T>): Promise<{ value: T; status: CacheStatus; storedAt: string }> {
  const now = Date.now();
  const memory = getMemoryCache<Envelope<T>>(key);
  if (memory) {
    if (now < memory.freshUntil) {
      return { value: memory.value, status: "fresh", storedAt: memory.storedAt };
    }
    if (now < memory.staleUntil) {
      revalidate(key, ttlSeconds, staleSeconds, load, isUsable);
      return { value: memory.value, status: "stale", storedAt: memory.storedAt };
    }
  }

  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<Envelope<T>>(key);
      if (cached && now < cached.staleUntil) {
        setMemoryCache(key, cached, Math.max(1, Math.ceil((cached.staleUntil - now) / 1000)));
        if (now < cached.freshUntil) {
          return { value: cached.value, status: "fresh", storedAt: cached.storedAt };
        }
        revalidate(key, ttlSeconds, staleSeconds, load, isUsable);
        return { value: cached.value, status: "stale", storedAt: cached.storedAt };
      }
    } catch (error) {
      console.warn(`[cache] Redis read failed for ${key}:`, error);
    }
  }

  const envelope = await refresh(key, ttlSeconds, staleSeconds, load, isUsable);
  return { value: envelope.value, status: "miss", storedAt: envelope.storedAt };
}

async function refresh<T>(
  key: string,
  ttlSeconds: number,
  staleSeconds: number,
  load: () => Promise<T>,
  isUsable: (value: T) => boolean
) {
  const value = await load();
  if (!isUsable(value)) throw new Error(`Cache load for ${key} returned unusable data`);

  const now = Date.now();
  const envelope: Envelope<T> = {
    value,
    storedAt: new Date(now).toISOString(),
    freshUntil: now + ttlSeconds * 1000,
    staleUntil: now + staleSeconds * 1000,
  };
  setMemoryCache(key, envelope, staleSeconds);

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, envelope, { ex: staleSeconds });
    } catch (error) {
      console.warn(`[cache] Redis write failed for ${key}:`, error);
    }
  }

  return envelope;
}

function revalidate<T>(
  key: string,
  ttlSeconds: number,
  staleSeconds: number,
  load: () => Promise<T>,
  isUsable: (value: T) => boolean
) {
  const store = inFlightStore();
  if (store.has(key)) return;

  const promise = refresh(key, ttlSeconds, staleSeconds, load, isUsable)
    .catch((error) => {
      console.warn(`[cache] Background refresh failed for ${key}:`, error);
    })
    .finally(() => {
      store.delete(key);
    });
  store.set(key, promise);
}
