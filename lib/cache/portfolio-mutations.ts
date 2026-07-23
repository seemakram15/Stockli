"use client";

import * as React from "react";
import type { CachedRecord } from "@/lib/hooks/use-persistent-resource";
import {
  lastCompletedPsxSessionDate,
  lastCompletedPsxSessionEnd,
} from "@/lib/psx/market-hours";

export const PORTFOLIO_MUTATION_EVENT = "stockli:portfolio-mutated";

const PORTFOLIO_MUTATION_STORAGE_KEY = "stockli:portfolio-mutated-at";

function portfolioMutationStorageKey(userId?: string | null) {
  const scopedUserId = userId?.trim();
  return scopedUserId
    ? `${PORTFOLIO_MUTATION_STORAGE_KEY}:${scopedUserId}`
    : PORTFOLIO_MUTATION_STORAGE_KEY;
}

export function markPortfolioMutated(detail?: { portfolioId?: string; userId?: string | null; deleted?: boolean }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    portfolioMutationStorageKey(detail?.userId ?? null),
    new Date().toISOString()
  );
  window.dispatchEvent(new CustomEvent(PORTFOLIO_MUTATION_EVENT, { detail }));
}

export function isPortfolioCacheFresh<T>(record: CachedRecord<T>, userId?: string | null) {
  if (typeof window === "undefined") return true;
  const mutatedAt = window.localStorage.getItem(portfolioMutationStorageKey(userId));
  if (mutatedAt) {
    const savedTime = Date.parse(record.savedAt);
    const mutationTime = Date.parse(mutatedAt);
    if (Number.isFinite(savedTime) && Number.isFinite(mutationTime) && savedTime < mutationTime) {
      return false;
    }
  }

  return isClosedMarketSnapshotCurrent(record);
}

/**
 * True when a frozen (closed-market) device snapshot is still valid for the
 * latest completed PSX session. Used by `acceptCacheWhen` so stale EOD snapshots
 * keep fetching instead of pausing forever.
 */
export function isClosedMarketSnapshotCurrent<T>(record: CachedRecord<T>) {
  const latestCompletedSessionDate = lastCompletedPsxSessionDate();
  if (!latestCompletedSessionDate) return true;

  const latestCalendarDate = extractLatestCalendarDate(record.value);
  if (latestCalendarDate) {
    return latestCalendarDate >= latestCompletedSessionDate;
  }

  const latestCompletedSessionEnd = lastCompletedPsxSessionEnd();
  if (!latestCompletedSessionEnd) return true;

  const snapshotTime = extractSnapshotTime(record);
  if (snapshotTime == null) return true;
  return snapshotTime >= latestCompletedSessionEnd.getTime();
}

/** Refresh callbacks when this tab or another tab mutates portfolios. */
export function usePortfolioMutationRefresh(
  refresh: () => void,
  userId?: string | null
) {
  React.useEffect(() => {
    const onMutation = () => {
      refresh();
    };
    const mutationKey = portfolioMutationStorageKey(userId);
    const onStorage = (event: StorageEvent) => {
      if (event.key === mutationKey && event.newValue) refresh();
    };
    window.addEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PORTFOLIO_MUTATION_EVENT, onMutation);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh, userId]);
}

function extractSnapshotTime<T>(record: CachedRecord<T>) {
  const candidates = [Date.parse(record.savedAt)];
  const updatedAt = extractUpdatedAt(record.value);
  if (updatedAt) candidates.push(Date.parse(updatedAt));

  const valid = candidates.filter(Number.isFinite);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}

function extractUpdatedAt(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("updatedAt" in value)) return null;
  const updatedAt = (value as { updatedAt?: unknown }).updatedAt;
  return typeof updatedAt === "string" ? updatedAt : null;
}

function extractLatestCalendarDate(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("calendar" in value)) return null;
  const calendar = (value as { calendar?: unknown }).calendar;
  if (!calendar || typeof calendar !== "object" || !("days" in calendar)) return null;

  const days = (calendar as { days?: unknown }).days;
  if (!Array.isArray(days) || days.length === 0) return null;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (!day || typeof day !== "object" || !("date" in day)) continue;
    const date = (day as { date?: unknown }).date;
    if (typeof date === "string" && date.trim().length > 0) return date;
  }

  return null;
}
