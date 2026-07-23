"use client";

import * as React from "react";
import { Database, DownloadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PUBLIC_DEVICE_CACHE_JOBS } from "@/lib/device-cache/public-cache-jobs";
import { writePersistentResourceCacheBatch } from "@/lib/hooks/use-persistent-resource";
import type { StockFinancialsData } from "@/lib/types/stock-fundamentals";

type FundamentalsSnapshotBatch = {
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  records: Array<{
    symbol: string;
    storedAt: string;
    data: StockFinancialsData;
  }>;
};

const FUNDAMENTALS_BATCH_SIZE = 60;
const CACHE_VERSION = "v4";
const COMPLETE_PREFIX = "stockli:fundamentals-device-cache:complete";
const SNOOZE_PREFIX = "stockli:fundamentals-device-cache:snooze";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PUBLIC_FETCH_CONCURRENCY = 4;
const FUNDAMENTALS_FETCH_CONCURRENCY = 3;

export function FundamentalsDeviceCachePrompt({ userId }: { userId: string }) {
  const [open, setOpen] = React.useState(false);
  const [state, setState] = React.useState<CacheState>({ status: "idle", stored: 0, total: 0 });

  React.useEffect(() => {
    const completeKey = completeStorageKey(userId);
    const snoozeKey = snoozeStorageKey(userId);
    const complete = window.localStorage.getItem(completeKey);
    const snoozedUntil = Number(window.localStorage.getItem(snoozeKey) ?? "0");
    if (complete !== CACHE_VERSION && Date.now() > snoozedUntil) {
      const id = window.setTimeout(() => setOpen(true), 800);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [userId]);

  async function startCache() {
    try {
      const result = await cacheAllFundamentalsToDevice((next) => setState(next));
      if (result.failures.length > 0) {
        toast.warning(
          `Cached ${result.stored}/${result.total} public records. Some feeds will retry next time.`
        );
      } else if (result.stored < result.total) {
        window.localStorage.setItem(completeStorageKey(userId), CACHE_VERSION);
        window.localStorage.removeItem(snoozeStorageKey(userId));
        toast.warning(
          `Cached ${result.stored}/${result.total} public records. Some stock archives are still preparing and will fill in later.`
        );
        setOpen(false);
      } else {
        window.localStorage.setItem(completeStorageKey(userId), CACHE_VERSION);
        window.localStorage.removeItem(snoozeStorageKey(userId));
        toast.success(`Cached ${result.stored} public records on this device.`);
        setOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cache device data.");
      setState((current) => ({ ...current, status: "error" }));
    }
  }

  function snooze() {
    window.localStorage.setItem(snoozeStorageKey(userId), String(Date.now() + ONE_DAY_MS));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (state.status === "running") return;
      setOpen(nextOpen);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Database className="size-5" />
          </div>
          <DialogTitle>Cache MyStockli data on this device</DialogTitle>
          <DialogDescription>
            MyStockli can save fundamentals, market pages, MUFAP, global boards and other public
            Redis-backed data locally so screens open quickly, even when the network is slow.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {state.status === "running"
                ? "Caching public data to this device..."
                : state.status === "done"
                  ? "Public data is cached."
                  : "Ready to cache public data."}
            </span>
            <span className="font-semibold tabular-nums">
              {state.total ? `${state.stored}/${state.total}` : `${state.stored}`}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent(state)}%` }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={snooze} disabled={state.status === "running"}>
            Later
          </Button>
          <Button type="button" onClick={() => void startCache()} disabled={state.status === "running"}>
            {state.status === "running" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DownloadCloud className="size-4" />
            )}
            Cache now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FundamentalsDeviceCacheButton({ className }: { className?: string }) {
  const [state, setState] = React.useState<CacheState>({ status: "idle", stored: 0, total: 0 });

  async function startCache() {
    try {
      const result = await cacheAllFundamentalsToDevice((next) => setState(next));
      if (result.failures.length > 0) {
        toast.warning(
          `Cached ${result.stored}/${result.total} public records. Some feeds will retry next time.`
        );
      } else if (result.stored < result.total) {
        toast.warning(
          `Cached ${result.stored}/${result.total} public records. Some stock archives are still preparing and will fill in later.`
        );
      } else {
        toast.success(`Cached ${result.stored} public records on this device.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cache device data.");
      setState((current) => ({ ...current, status: "error" }));
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => void startCache()}
      disabled={state.status === "running"}
    >
      {state.status === "running" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <DownloadCloud className="size-4" />
      )}
      {state.status === "running"
        ? `Caching ${state.total ? `${state.stored}/${state.total}` : state.stored}`
        : "Cache device data"}
    </Button>
  );
}

type CacheState = {
  status: "idle" | "running" | "done" | "error";
  stored: number;
  total: number;
};

async function cacheAllFundamentalsToDevice(onProgress?: (state: CacheState) => void) {
  let stored = 0;
  let total = PUBLIC_DEVICE_CACHE_JOBS.length;
  const failures: string[] = [];
  onProgress?.({ status: "running", stored, total });

  const publicResults = await fetchJobsInChunks(PUBLIC_DEVICE_CACHE_JOBS, PUBLIC_FETCH_CONCURRENCY);
  const publicEntries = publicResults.flatMap((result) =>
    result.ok
      ? [{ cacheKey: result.job.cacheKey, value: result.data }]
      : []
  );
  if (publicEntries.length > 0) {
    await writePersistentResourceCacheBatch(publicEntries);
    stored += publicEntries.length;
  }
  failures.push(
    ...publicResults
      .filter((result): result is FailedPublicJob => !result.ok)
      .map((result) => `${result.job.cacheKey}: ${result.error}`)
  );
  onProgress?.({ status: "running", stored, total });

  const firstBatch = await fetchSnapshotBatch(0);
  total += firstBatch.total;
  stored += await writeFundamentalsBatch(firstBatch.records);
  onProgress?.({ status: "running", stored, total });

  const remainingOffsets: number[] = [];
  for (
    let nextOffset = firstBatch.nextOffset;
    nextOffset !== null && nextOffset < firstBatch.total;
    nextOffset += firstBatch.limit
  ) {
    remainingOffsets.push(nextOffset);
  }

  for (const offsets of chunk(remainingOffsets, FUNDAMENTALS_FETCH_CONCURRENCY)) {
    const batches = await Promise.all(offsets.map((offset) => fetchSnapshotBatch(offset)));
    const records = batches.flatMap((batch) => batch.records);
    stored += await writeFundamentalsBatch(records);
    onProgress?.({ status: "running", stored, total });
  }

  onProgress?.({ status: "done", stored, total });
  return { stored, total, failures };
}

async function fetchSnapshotBatch(offset: number): Promise<FundamentalsSnapshotBatch> {
  const response = await fetch(
    `/api/public/stock-fundamentals/snapshots?offset=${offset}&limit=${FUNDAMENTALS_BATCH_SIZE}`,
    { headers: { accept: "application/json" } }
  );
  const payload = (await response.json()) as { data?: FundamentalsSnapshotBatch; error?: string };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error ?? "Fundamentals cache batch unavailable.");
  }
  return payload.data;
}

function completeStorageKey(userId: string) {
  return `${COMPLETE_PREFIX}:${userId}`;
}

function snoozeStorageKey(userId: string) {
  return `${SNOOZE_PREFIX}:${userId}`;
}

function progressPercent(state: CacheState) {
  if (!state.total) return state.status === "running" ? 8 : 0;
  return Math.min(100, Math.max(2, Math.round((state.stored / state.total) * 100)));
}

async function writeFundamentalsBatch(records: FundamentalsSnapshotBatch["records"]) {
  if (records.length === 0) return 0;
  return writePersistentResourceCacheBatch(
    records.map((record) => ({
      cacheKey: `public:stock-financials:v4:${record.symbol}`,
      value: record.data,
      savedAt: record.storedAt,
    }))
  );
}

type SuccessfulPublicJob = {
  ok: true;
  job: (typeof PUBLIC_DEVICE_CACHE_JOBS)[number];
  data: unknown;
};

type FailedPublicJob = {
  ok: false;
  job: (typeof PUBLIC_DEVICE_CACHE_JOBS)[number];
  error: string;
};

async function fetchJobsInChunks(
  jobs: typeof PUBLIC_DEVICE_CACHE_JOBS,
  concurrency: number
): Promise<Array<SuccessfulPublicJob | FailedPublicJob>> {
  const results: Array<SuccessfulPublicJob | FailedPublicJob> = [];
  for (const group of chunk(jobs, concurrency)) {
    const settled = await Promise.all(group.map(fetchPublicCacheJob));
    results.push(...settled);
  }
  return results;
}

async function fetchPublicCacheJob(
  job: (typeof PUBLIC_DEVICE_CACHE_JOBS)[number]
): Promise<SuccessfulPublicJob | FailedPublicJob> {
  try {
    const response = await fetch(job.url, {
      headers: { accept: "application/json" },
    });
    const payload = (await response.json()) as { data?: unknown; error?: string };
    if (!response.ok || !("data" in payload)) {
      throw new Error(payload.error ?? `Request failed (${response.status})`);
    }
    return { ok: true, job, data: payload.data };
  } catch (error) {
    return {
      ok: false,
      job,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}
