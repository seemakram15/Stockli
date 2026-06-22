"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const PREFETCH_ROUTES = [
  "/dashboard",
  "/portfolios",
  "/market",
  "/market/strategy",
  "/market/mutual-funds",
  "/market/etfs",
  "/market/us",
  "/market/india",
  "/market/world",
  "/watchlist",
  "/alerts",
];

export function RoutePrefetcher() {
  const router = useRouter();

  React.useEffect(() => {
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    const prefetch = () => {
      PREFETCH_ROUTES.forEach((route, index) => {
        timeoutIds.push(setTimeout(() => router.prefetch(route), index * 120));
      });
    };
    const clearPrefetchTimers = () => {
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
    };

    const scheduleIdle = globalThis.requestIdleCallback?.bind(globalThis);
    const cancelIdle = globalThis.cancelIdleCallback?.bind(globalThis);

    if (scheduleIdle && cancelIdle) {
      const idleId = scheduleIdle(prefetch, { timeout: 2500 });
      return () => {
        cancelIdle(idleId);
        clearPrefetchTimers();
      };
    }

    const timeoutId = setTimeout(prefetch, 800);
    return () => {
      clearTimeout(timeoutId);
      clearPrefetchTimers();
    };
  }, [router]);

  return null;
}
