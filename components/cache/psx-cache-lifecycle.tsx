"use client";

import * as React from "react";
import { psxSessionCycleId } from "@/lib/psx/market-hours";
import { deletePersistentResourceCache } from "@/lib/hooks/use-persistent-resource";
import { invalidateClientPriceCaches } from "@/lib/hooks/use-prices";

const STORAGE_KEY = "stockli:psx-cache-cycle";

/**
 * PSX-tied device-cache snapshots that are frozen while the exchange is closed
 * and must be dropped once a new trading session opens. Global (US/India/crypto)
 * boards are intentionally excluded — they follow their own clocks and must not
 * be wiped by the Pakistan session cycle.
 */
const PSX_SNAPSHOT_KEYS = [
  "public:psx-market:v3",
  "public:market-strategy",
  "public:mufap:mutual",
  "public:mufap:etfs",
];

/**
 * Watches the PSX session cycle and, the first time a new trading session is
 * observed (≈09:15 each trading day), removes the previous day's frozen PSX
 * snapshots from the device cache. After close the snapshot is left untouched so
 * returning visitors keep getting the instant cached view.
 */
export function PsxCacheLifecycle() {
  React.useEffect(() => {
    function check() {
      const cycle = psxSessionCycleId();
      if (!cycle) return; // Market closed — keep the frozen snapshot as-is.

      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        // Storage may be unavailable; the open-market live poll still refreshes.
      }
      if (stored === cycle) return; // Already reset for this session.

      invalidateClientPriceCaches();
      void Promise.all(
        PSX_SNAPSHOT_KEYS.map((key) =>
          deletePersistentResourceCache(key).catch(() => undefined)
        )
      ).finally(() => {
        try {
          window.localStorage.setItem(STORAGE_KEY, cycle);
        } catch {
          // ignore
        }
      });
    }

    check();
    const id = window.setInterval(check, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
