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
import { writePersistentResourceCache } from "@/lib/hooks/use-persistent-resource";
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

const BATCH_SIZE = 20;
const CACHE_VERSION = "v4";
const COMPLETE_PREFIX = "stockli:fundamentals-device-cache:complete";
const SNOOZE_PREFIX = "stockli:fundamentals-device-cache:snooze";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
      window.localStorage.setItem(completeStorageKey(userId), CACHE_VERSION);
      window.localStorage.removeItem(snoozeStorageKey(userId));
      toast.success(`Cached ${result.stored} company fundamentals on this device.`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cache fundamentals.");
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
          <DialogTitle>Cache fundamentals on this device</DialogTitle>
          <DialogDescription>
            Stockli can save company fundamentals locally so peer comparison and statement views open
            quickly, even when the market is closed or the network is slow.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {state.status === "running"
                ? "Caching company fundamentals..."
                : state.status === "done"
                  ? "Fundamentals are cached."
                  : "Ready to cache fundamentals."}
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
      toast.success(`Cached ${result.stored} company fundamentals on this device.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cache fundamentals.");
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
        : "Cache fundamentals"}
    </Button>
  );
}

type CacheState = {
  status: "idle" | "running" | "done" | "error";
  stored: number;
  total: number;
};

async function cacheAllFundamentalsToDevice(onProgress?: (state: CacheState) => void) {
  let offset = 0;
  let stored = 0;
  let total = 0;
  onProgress?.({ status: "running", stored, total });

  while (true) {
    const batch = await fetchSnapshotBatch(offset);
    total = batch.total;
    await Promise.all(
      batch.records.map((record) =>
        writePersistentResourceCache(`public:stock-financials:v4:${record.symbol}`, record.data)
      )
    );
    stored += batch.records.length;
    onProgress?.({ status: "running", stored, total });
    if (batch.nextOffset === null) break;
    offset = batch.nextOffset;
  }

  onProgress?.({ status: "done", stored, total });
  return { stored, total };
}

async function fetchSnapshotBatch(offset: number): Promise<FundamentalsSnapshotBatch> {
  const response = await fetch(
    `/api/public/stock-fundamentals/snapshots?offset=${offset}&limit=${BATCH_SIZE}`,
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
