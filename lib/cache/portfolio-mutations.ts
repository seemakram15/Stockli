"use client";

import type { CachedRecord } from "@/lib/hooks/use-persistent-resource";

export const PORTFOLIO_MUTATION_EVENT = "stockli:portfolio-mutated";

const PORTFOLIO_MUTATION_STORAGE_KEY = "stockli:portfolio-mutated-at";

function portfolioMutationStorageKey(userId?: string | null) {
  const scopedUserId = userId?.trim();
  return scopedUserId
    ? `${PORTFOLIO_MUTATION_STORAGE_KEY}:${scopedUserId}`
    : PORTFOLIO_MUTATION_STORAGE_KEY;
}

export function markPortfolioMutated(detail?: { portfolioId?: string; userId?: string | null }) {
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
  if (!mutatedAt) return true;
  const savedTime = Date.parse(record.savedAt);
  const mutationTime = Date.parse(mutatedAt);
  if (!Number.isFinite(savedTime) || !Number.isFinite(mutationTime)) return true;
  return savedTime >= mutationTime;
}
