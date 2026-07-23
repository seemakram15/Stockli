import "server-only";

import { askAnalystLogoUrl } from "@/lib/company-icons";
import { getMemoryCache, setMemoryCache } from "@/lib/cache/memory";
import { getRedisClients } from "@/lib/cache/redis";
import { normalizeSymbol, normalizeSymbols } from "@/lib/security/validation";

const CACHE_PREFIX = "company-icon:v1:";
const MISS_PREFIX = "company-icon-miss:v1:";
const HIT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MISS_TTL_SECONDS = 6 * 60 * 60;
const FETCH_TIMEOUT_MS = 4_000;
const WARM_CONCURRENCY = 6;
const WARM_SYMBOL_LIMIT = 24;

export type CachedCompanyIcon = {
  symbol: string;
  contentType: string;
  base64: string;
  source: string;
  storedAt: string;
};

type WarmResult = {
  symbol: string;
  ok: boolean;
  cached: boolean;
  skipped?: boolean;
  error?: string;
};

/**
 * Resolve a company icon from memory/Redis, or fetch + cache from AskAnalyst.
 * Returns null when the upstream has no logo (negative-cached briefly).
 */
export async function getCompanyIcon(rawSymbol: string): Promise<CachedCompanyIcon | null> {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) return null;

  const hitKey = `${CACHE_PREFIX}${symbol}`;
  const missKey = `${MISS_PREFIX}${symbol}`;

  const memoryHit = getMemoryCache<CachedCompanyIcon>(hitKey);
  if (memoryHit) return memoryHit;

  if (getMemoryCache<true>(missKey)) return null;

  for (const redis of getRedisClients()) {
    try {
      const cached = await redis.get<CachedCompanyIcon>(hitKey);
      if (cached?.base64) {
        setMemoryCache(hitKey, cached, HIT_TTL_SECONDS);
        return cached;
      }
      const missed = await redis.get<string>(missKey);
      if (missed) {
        setMemoryCache(missKey, true, MISS_TTL_SECONDS);
        return null;
      }
    } catch {
      // Try the next Redis client / fall through to fetch.
    }
  }

  return fetchAndStoreIcon(symbol);
}

/** Warm icons for a symbol list under a hard time budget. Best-effort. */
export async function warmCompanyIcons(
  rawSymbols: unknown[],
  options?: { budgetMs?: number; limit?: number }
): Promise<{ warmed: number; results: WarmResult[] }> {
  const limit = Math.min(options?.limit ?? WARM_SYMBOL_LIMIT, WARM_SYMBOL_LIMIT);
  const symbols = normalizeSymbols(rawSymbols, limit);
  const budgetMs = Math.max(500, Math.min(options?.budgetMs ?? 8_000, 9_500));
  const deadline = Date.now() + budgetMs;
  const results: WarmResult[] = [];

  for (let i = 0; i < symbols.length; i += WARM_CONCURRENCY) {
    if (Date.now() >= deadline) {
      for (const symbol of symbols.slice(i)) {
        results.push({ symbol, ok: false, cached: false, skipped: true });
      }
      break;
    }

    const batch = symbols.slice(i, i + WARM_CONCURRENCY);
    const remaining = Math.max(200, deadline - Date.now());
    const settled = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const icon = await Promise.race([
            getCompanyIcon(symbol),
            sleep(remaining).then(() => null),
          ]);
          return {
            symbol,
            ok: Boolean(icon),
            cached: Boolean(icon),
            skipped: !icon && Date.now() >= deadline,
          } satisfies WarmResult;
        } catch (error) {
          return {
            symbol,
            ok: false,
            cached: false,
            error: error instanceof Error ? error.message : String(error),
          } satisfies WarmResult;
        }
      })
    );
    results.push(...settled);
  }

  return {
    warmed: results.filter((r) => r.ok).length,
    results,
  };
}

async function fetchAndStoreIcon(symbol: string): Promise<CachedCompanyIcon | null> {
  const hitKey = `${CACHE_PREFIX}${symbol}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(askAnalystLogoUrl(symbol), {
      signal: controller.signal,
      headers: { accept: "image/svg+xml,image/*,*/*;q=0.8" },
      cache: "force-cache",
    });
    if (!response.ok) {
      await storeMiss(symbol);
      return null;
    }

    const contentType = normalizeContentType(response.headers.get("content-type"));
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 32 || buffer.byteLength > 250_000) {
      await storeMiss(symbol);
      return null;
    }

    const record: CachedCompanyIcon = {
      symbol,
      contentType,
      base64: buffer.toString("base64"),
      source: "askanalyst",
      storedAt: new Date().toISOString(),
    };

    setMemoryCache(hitKey, record, HIT_TTL_SECONDS);
    await Promise.allSettled(
      getRedisClients().map((redis) => redis.set(hitKey, record, { ex: HIT_TTL_SECONDS }))
    );
    return record;
  } catch {
    await storeMiss(symbol);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function storeMiss(symbol: string) {
  const missKey = `${MISS_PREFIX}${symbol}`;
  setMemoryCache(missKey, true, MISS_TTL_SECONDS);
  await Promise.allSettled(
    getRedisClients().map((redis) => redis.set(missKey, "1", { ex: MISS_TTL_SECONDS }))
  );
}

function normalizeContentType(value: string | null): string {
  const raw = (value ?? "image/svg+xml").split(";")[0]?.trim().toLowerCase();
  if (raw === "image/svg+xml" || raw === "image/png" || raw === "image/jpeg" || raw === "image/webp") {
    return raw;
  }
  return "image/svg+xml";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
