"use client";

import * as React from "react";

const SESSION_KEY = "stockli:last-background-warmup";
const SESSION_THROTTLE_MS = 5 * 60_000;

export function BackgroundCacheWarmup() {
  React.useEffect(() => {
    const now = Date.now();
    try {
      const last = Number(window.sessionStorage.getItem(SESSION_KEY) ?? "0");
      if (Number.isFinite(last) && now - last < SESSION_THROTTLE_MS) return;
      window.sessionStorage.setItem(SESSION_KEY, String(now));
    } catch {
      // Storage can be disabled; the server endpoint is still throttled.
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/background/warmup", {
        method: "POST",
        headers: { accept: "application/json" },
        signal: controller.signal,
      }).catch(() => undefined);
    }, 1200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return null;
}

