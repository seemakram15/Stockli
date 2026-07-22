import "server-only";

type Entry<T> = {
  value?: T;
  expiresAt: number;
  promise?: Promise<T>;
};

type Store = Map<string, Entry<unknown>>;

const GLOBAL_KEY = "__stockli_memory_cache__";

function store(): Store {
  const root = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Store };
  if (!root[GLOBAL_KEY]) root[GLOBAL_KEY] = new Map();
  return root[GLOBAL_KEY];
}

export function getMemoryCache<T>(key: string): T | null {
  const entry = store().get(key) as Entry<T> | undefined;
  if (!entry || Date.now() >= entry.expiresAt || entry.value === undefined) {
    if (entry && Date.now() >= entry.expiresAt) store().delete(key);
    return null;
  }
  return entry.value;
}

export function setMemoryCache<T>(key: string, value: T, ttlSeconds: number): T {
  store().set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  return value;
}

export function deleteMemoryCache(key: string): void {
  store().delete(key);
}

/** Drop every in-memory entry whose key starts with `prefix`. */
export function deleteMemoryCacheByPrefix(prefix: string): number {
  let removed = 0;
  for (const key of store().keys()) {
    if (!key.startsWith(prefix)) continue;
    store().delete(key);
    removed += 1;
  }
  return removed;
}

export async function getOrSetMemoryCache<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
  isUsable: (value: T) => boolean = Boolean
): Promise<T> {
  const now = Date.now();
  const existing = store().get(key) as Entry<T> | undefined;
  if (existing && now < existing.expiresAt) {
    if (existing.value !== undefined) return existing.value;
    if (existing.promise) return existing.promise;
  }

  const promise = load()
    .then((value) => {
      if (isUsable(value)) {
        setMemoryCache(key, value, ttlSeconds);
      } else {
        store().delete(key);
      }
      return value;
    })
    .catch((error) => {
      store().delete(key);
      throw error;
    });

  store().set(key, { promise, expiresAt: now + ttlSeconds * 1000 });
  return promise;
}
