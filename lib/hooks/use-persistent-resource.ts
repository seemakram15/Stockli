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
}: {
  cacheKey: string;
  url: string;
  refreshInterval?: number | ((data: T | null) => number);
  pauseWhen?: (data: T | null) => boolean;
  acceptCacheWhen?: (record: CachedRecord<T>) => boolean;
}) {
  const [cached, setCached] = React.useState<CachedRecord<T> | null>(null);
  const [cacheReady, setCacheReady] = React.useState(false);
  const [, setClockTick] = React.useState(0);
  const hasPauseRule = Boolean(pauseWhen);

  React.useEffect(() => {
    let cancelled = false;
    readCached<T>(cacheKey)
      .then((record) => {
        if (!cancelled) setCached(record);
      })
      .finally(() => {
        if (!cancelled) setCacheReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  React.useEffect(() => {
    if (!hasPauseRule) return undefined;
    const id = window.setInterval(() => setClockTick((tick) => tick + 1), 60_000);
    return () => window.clearInterval(id);
  }, [hasPauseRule]);

  const usableCached = cached && (!acceptCacheWhen || acceptCacheWhen(cached)) ? cached : null;
  const cachedValue = usableCached?.value ?? null;
  const rawCachedValue = cached?.value ?? null;
  const isPaused = Boolean(cacheReady && rawCachedValue && pauseWhen?.(rawCachedValue));
  const swrKey = cacheReady && !isPaused ? url : null;

  const swr = useSWR<T>(swrKey, fetchResource, {
    dedupingInterval: 15_000,
    keepPreviousData: true,
    revalidateOnFocus: !isPaused,
    revalidateOnReconnect: !isPaused,
    refreshInterval: (latest) => {
      const value = latest ?? rawCachedValue;
      if (pauseWhen?.(value ?? null)) return 0;
      return typeof refreshInterval === "function"
        ? refreshInterval(value ?? null)
        : refreshInterval;
    },
  });

  React.useEffect(() => {
    if (!swr.data) return;
    const record = makeCachedRecord(cacheKey, swr.data);
    setCached(record);
    writeCached(record).catch(() => undefined);
  }, [cacheKey, swr.data]);

  const refreshNow = React.useCallback(async () => {
    const value = await fetchResource<T>(url);
    const record = makeCachedRecord(cacheKey, value);
    setCached(record);
    await Promise.all([
      writeCached(record).catch(() => undefined),
      swr.mutate(value, { revalidate: false }),
    ]);
    return value;
  }, [cacheKey, swr, url]);

  const data = swr.data ?? cachedValue;

  return {
    data,
    error: swr.error as Error | undefined,
    isLoading: !data && (!cacheReady || swr.isLoading),
    isRefreshing: Boolean(data && swr.isValidating),
    isFromDeviceCache: Boolean(!swr.data && usableCached?.value),
    cachedAt: usableCached?.savedAt ?? null,
    lastCachedAt: cached?.savedAt ?? null,
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
