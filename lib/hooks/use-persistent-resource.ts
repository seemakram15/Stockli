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
  const isPrivateResource = cacheKey.startsWith("private:");
  const keepPrevious = isPrivateResource ? false : keepPreviousData;

  React.useEffect(() => {
    let cancelled = false;
    const memoryRecord = readMemoryCached<T>(cacheKey, legacyCacheKeys);
    setCached(memoryRecord);
    setCacheReady(Boolean(memoryRecord));
    legacyCacheKeys.forEach((key) => {
      if (key && key !== cacheKey) {
        MEMORY_CACHE.delete(key);
        deleteCached(key).catch(() => undefined);
      }
    });
    readCached<T>(cacheKey)
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
    writeCached(record).catch(() => undefined);
  }, [cacheKey, swr.data]);

  const refreshNow = React.useCallback(async () => {
    const value = await fetchResource<T>(url);
    const record = makeCachedRecord(cacheKey, value);
    writeMemoryCached(record);
    setCached(record);
    await Promise.all([
      writeCached(record).catch(() => undefined),
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
  await writeCached(record);
  return record;
}

export async function deletePersistentResourceCache(cacheKey: string): Promise<void> {
  MEMORY_CACHE.delete(cacheKey);
  await deleteCached(cacheKey);
}

function makeCachedRecord<T>(key: string, value: T): CachedRecord<T> {
  return {
    key,
    value,
    savedAt: new Date().toISOString(),
  };
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

async function readCached<T>(key: string): Promise<CachedRecord<T> | null> {
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

async function writeCached<T>(record: CachedRecord<T>): Promise<void> {
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

async function deleteCached(key: string): Promise<void> {
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
