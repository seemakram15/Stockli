"use client";

import * as React from "react";
import useSWR from "swr";

type ResourceResponse<T> = {
  data: T;
};

export type CachedRecord<T> = {
  key: string;
  value: T;
  savedAt: string;
};

const DB_NAME = "stockli-public-cache";
const STORE_NAME = "resources";
const DB_VERSION = 1;
const MEMORY_CACHE = new Map<string, CachedRecord<unknown>>();
const EMPTY_LEGACY_CACHE_KEYS: string[] = [];
const PRIVATE_CACHE_PREFIX = "private:";
const PRIVATE_SESSION_PREFIX = "stockli:private-resource:";
const ACTIVE_PRIVATE_USER_KEY = "stockli:private-cache-user";
const LEGACY_PRIVATE_CACHE_CLEANUP_KEY = "stockli:private-cache-cleaned:v2";
const PORTFOLIO_MUTATION_STORAGE_PREFIX = "stockli:portfolio-mutated-at";

async function fetchResource<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const json = (await response.json()) as ResourceResponse<T>;
  return json.data;
}

export function usePersistentResource<T>({
  cacheKey,
  url,
  refreshInterval = 60_000,
  pauseWhen,
  acceptCacheWhen,
  keepPreviousData = true,
  legacyCacheKeys = EMPTY_LEGACY_CACHE_KEYS,
}: {
  cacheKey: string;
  url: string;
  refreshInterval?: number | ((data: T | null) => number);
  pauseWhen?: (data: T | null) => boolean;
  acceptCacheWhen?: (record: CachedRecord<T>) => boolean;
  keepPreviousData?: boolean;
  legacyCacheKeys?: string[];
}) {
  const [cached, setCached] = React.useState<CachedRecord<T> | null>(() =>
    readMemoryCached<T>(cacheKey, legacyCacheKeys)
  );
  const [cacheReady, setCacheReady] = React.useState(() =>
    Boolean(readMemoryCached<T>(cacheKey, legacyCacheKeys))
  );
  const [, setClockTick] = React.useState(0);
  const hasPauseRule = Boolean(pauseWhen);
  const isPrivateResource = isPrivateCacheKey(cacheKey);
  const keepPrevious = isPrivateResource ? false : keepPreviousData;

  React.useEffect(() => {
    let cancelled = false;
    const memoryRecord = readMemoryCached<T>(cacheKey, legacyCacheKeys);
    setCached(memoryRecord);
    setCacheReady(Boolean(memoryRecord));
    legacyCacheKeys.forEach((key) => {
      if (key && key !== cacheKey) {
        MEMORY_CACHE.delete(key);
        deleteStorageCached(key).catch(() => undefined);
      }
    });
    readStorageCached<T>(cacheKey)
      .then((record) => {
        if (record) writeMemoryCached(record);
        if (!cancelled) setCached(record ?? memoryRecord);
      })
      .finally(() => {
        if (!cancelled) setCacheReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, legacyCacheKeys]);

  React.useEffect(() => {
    if (!hasPauseRule) return undefined;
    const id = window.setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, [hasPauseRule]);

  const activeCached = cached?.key === cacheKey ? cached : null;
  const usableCached =
    activeCached && (!acceptCacheWhen || acceptCacheWhen(activeCached)) ? activeCached : null;
  const cachedValue = usableCached?.value ?? null;
  const rawCachedValue = activeCached?.value ?? null;
  const isPaused = Boolean(cacheReady && cachedValue && pauseWhen?.(cachedValue));
  const swrKey = cacheReady && !isPaused ? ([cacheKey, url] as const) : null;

  const swr = useSWR<T>(
    swrKey,
    ([, requestUrl]: readonly [string, string]) => fetchResource<T>(requestUrl),
    {
      dedupingInterval: 15_000,
      keepPreviousData: keepPrevious,
      revalidateOnFocus: !isPaused,
      revalidateOnReconnect: !isPaused,
      refreshInterval: (latest) => {
        const value = latest ?? rawCachedValue;
        if (pauseWhen?.(value ?? null)) return 0;
        return typeof refreshInterval === "function"
          ? refreshInterval(value ?? null)
          : refreshInterval;
      },
    }
  );

  React.useEffect(() => {
    if (!swr.data) return;
    const record = makeCachedRecord(cacheKey, swr.data);
    writeMemoryCached(record);
    setCached(record);
    writeStorageCached(record).catch(() => undefined);
  }, [cacheKey, swr.data]);

  const refreshNow = React.useCallback(async () => {
    const value = await fetchResource<T>(url);
    const record = makeCachedRecord(cacheKey, value);
    writeMemoryCached(record);
    setCached(record);
    await Promise.all([
      writeStorageCached(record).catch(() => undefined),
      swr.mutate(value, { revalidate: false }),
    ]);
    return value;
  }, [cacheKey, swr, url]);

  const data = swr.data ?? cachedValue ?? rawCachedValue;

  return {
    data,
    error: swr.error as Error | undefined,
    isLoading: !data && (!cacheReady || swr.isLoading),
    isRefreshing: Boolean(data && swr.isValidating),
    isFromDeviceCache: Boolean(!swr.data && rawCachedValue),
    cachedAt: usableCached?.savedAt ?? null,
    lastCachedAt: activeCached?.savedAt ?? null,
    mutate: swr.mutate,
    refreshNow,
  };
}

export async function writePersistentResourceCache<T>(
  cacheKey: string,
  value: T
): Promise<CachedRecord<T>> {
  const record = makeCachedRecord(cacheKey, value);
  writeMemoryCached(record);
  await writeStorageCached(record);
  return record;
}

export async function writePersistentResourceCacheBatch(
  entries: Array<{
    cacheKey: string;
    value: unknown;
    savedAt?: string;
  }>
): Promise<number> {
  if (entries.length === 0) return 0;

  const records = entries.map(({ cacheKey, value, savedAt }) => ({
    key: cacheKey,
    value,
    savedAt: savedAt ?? new Date().toISOString(),
  }));

  records.forEach((record) => writeMemoryCached(record));
  await writeStorageCachedBatch(records);
  return records.length;
}

export async function deletePersistentResourceCache(cacheKey: string): Promise<void> {
  MEMORY_CACHE.delete(cacheKey);
  await deleteStorageCached(cacheKey);
}

export async function clearPrivateResourceCaches(options?: {
  includeLegacyDeviceCache?: boolean;
}): Promise<void> {
  MEMORY_CACHE.forEach((_, key) => {
    if (isPrivateCacheKey(key)) MEMORY_CACHE.delete(key);
  });

  const sessionStorageRef = getStorage("session");
  if (sessionStorageRef) {
    const keysToRemove: string[] = [];
    for (let index = 0; index < sessionStorageRef.length; index += 1) {
      const key = sessionStorageRef.key(index);
      if (
        key &&
        (key.startsWith(PRIVATE_SESSION_PREFIX) || key === ACTIVE_PRIVATE_USER_KEY)
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorageRef.removeItem(key));
  }

  const localStorageRef = getStorage("local");
  if (localStorageRef) {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorageRef.length; index += 1) {
      const key = localStorageRef.key(index);
      if (key?.startsWith(PORTFOLIO_MUTATION_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorageRef.removeItem(key));
  }

  if (options?.includeLegacyDeviceCache) {
    await purgeLegacyPrivateIndexedDbCaches();
  }
}

export async function syncPrivateResourceCacheUser(userId: string): Promise<void> {
  const sessionStorageRef = getStorage("session");
  if (sessionStorageRef) {
    const activeUser = sessionStorageRef.getItem(ACTIVE_PRIVATE_USER_KEY);
    if (activeUser && activeUser !== userId) {
      await clearPrivateResourceCaches();
    }
    sessionStorageRef.setItem(ACTIVE_PRIVATE_USER_KEY, userId);
  }

  const localStorageRef = getStorage("local");
  if (!localStorageRef || localStorageRef.getItem(LEGACY_PRIVATE_CACHE_CLEANUP_KEY) === "1") {
    return;
  }

  await purgeLegacyPrivateIndexedDbCaches();
  localStorageRef.setItem(LEGACY_PRIVATE_CACHE_CLEANUP_KEY, "1");
}

function makeCachedRecord<T>(key: string, value: T): CachedRecord<T> {
  return {
    key,
    value,
    savedAt: new Date().toISOString(),
  };
}

function isPrivateCacheKey(cacheKey: string) {
  return cacheKey.startsWith(PRIVATE_CACHE_PREFIX);
}

function privateSessionStorageKey(cacheKey: string) {
  return `${PRIVATE_SESSION_PREFIX}${cacheKey}`;
}

function getStorage(kind: "session" | "local"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

async function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readStorageCached<T>(key: string): Promise<CachedRecord<T> | null> {
  if (isPrivateCacheKey(key)) {
    return readPrivateCached<T>(key);
  }
  return readPublicCached<T>(key);
}

async function writeStorageCached<T>(record: CachedRecord<T>): Promise<void> {
  if (isPrivateCacheKey(record.key)) {
    writePrivateCached(record);
    return;
  }
  await writePublicCached(record);
}

async function writeStorageCachedBatch(records: CachedRecord<unknown>[]): Promise<void> {
  const privateRecords = records.filter((record) => isPrivateCacheKey(record.key));
  const publicRecords = records.filter((record) => !isPrivateCacheKey(record.key));

  privateRecords.forEach((record) => writePrivateCached(record));
  await writePublicCachedBatch(publicRecords);
}

async function deleteStorageCached(key: string): Promise<void> {
  if (isPrivateCacheKey(key)) {
    deletePrivateCached(key);
    return;
  }
  await deletePublicCached(key);
}

function readPrivateCached<T>(key: string): CachedRecord<T> | null {
  const sessionStorageRef = getStorage("session");
  if (!sessionStorageRef) return null;

  const raw = sessionStorageRef.getItem(privateSessionStorageKey(key));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedRecord<T>;
    if (parsed?.key !== key || typeof parsed.savedAt !== "string") return null;
    return parsed;
  } catch {
    sessionStorageRef.removeItem(privateSessionStorageKey(key));
    return null;
  }
}

function writePrivateCached<T>(record: CachedRecord<T>): void {
  const sessionStorageRef = getStorage("session");
  if (!sessionStorageRef) return;
  sessionStorageRef.setItem(privateSessionStorageKey(record.key), JSON.stringify(record));
}

function deletePrivateCached(key: string): void {
  const sessionStorageRef = getStorage("session");
  if (!sessionStorageRef) return;
  sessionStorageRef.removeItem(privateSessionStorageKey(key));
}

async function readPublicCached<T>(key: string): Promise<CachedRecord<T> | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openCacheDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as CachedRecord<T> | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function writePublicCached<T>(record: CachedRecord<T>): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openCacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function writePublicCachedBatch(records: CachedRecord<unknown>[]): Promise<void> {
  if (typeof indexedDB === "undefined" || records.length === 0) return;
  const db = await openCacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      records.forEach((record) => {
        store.put(record);
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function deletePublicCached(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openCacheDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function purgeLegacyPrivateIndexedDbCaches(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const db = await openCacheDb();
  try {
    return await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();
      let removed = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(removed);
          return;
        }

        const key = typeof cursor.key === "string" ? cursor.key : "";
        if (!isPrivateCacheKey(key)) {
          cursor.continue();
          return;
        }

        const deleteRequest = cursor.delete();
        deleteRequest.onsuccess = () => {
          removed += 1;
          cursor.continue();
        };
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };

      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function readMemoryCached<T>(
  cacheKey: string,
  legacyCacheKeys: string[]
): CachedRecord<T> | null {
  const direct = MEMORY_CACHE.get(cacheKey) as CachedRecord<T> | undefined;
  if (direct) return direct;
  for (const key of legacyCacheKeys) {
    const legacy = MEMORY_CACHE.get(key) as CachedRecord<T> | undefined;
    if (legacy) return { ...legacy, key: cacheKey };
  }
  return null;
}

function writeMemoryCached<T>(record: CachedRecord<T>) {
  MEMORY_CACHE.set(record.key, record as CachedRecord<unknown>);
}
