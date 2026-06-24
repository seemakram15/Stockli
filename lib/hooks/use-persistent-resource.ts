"use client";

import * as React from "react";
import useSWR from "swr";

type ResourceResponse<T> = {
  data: T;
};

type CachedRecord<T> = {
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
}: {
  cacheKey: string;
  url: string;
  refreshInterval?: number;
}) {
  const [cached, setCached] = React.useState<CachedRecord<T> | null>(null);
  const [cacheReady, setCacheReady] = React.useState(false);

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

  const swr = useSWR<T>(url, fetchResource, {
    dedupingInterval: 15_000,
    keepPreviousData: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval,
  });

  React.useEffect(() => {
    if (!swr.data) return;
    const record = {
      key: cacheKey,
      value: swr.data,
      savedAt: new Date().toISOString(),
    };
    setCached(record);
    writeCached(record).catch(() => undefined);
  }, [cacheKey, swr.data]);

  const data = swr.data ?? cached?.value ?? null;

  return {
    data,
    error: swr.error as Error | undefined,
    isLoading: !data && (!cacheReady || swr.isLoading),
    isRefreshing: Boolean(data && swr.isValidating),
    isFromDeviceCache: Boolean(!swr.data && cached?.value),
    cachedAt: cached?.savedAt ?? null,
    mutate: swr.mutate,
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
