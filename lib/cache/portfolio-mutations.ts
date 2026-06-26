"use client";

import type { CachedRecord } from "@/lib/hooks/use-persistent-resource";

export const PORTFOLIO_MUTATION_EVENT = "stockli:portfolio-mutated";

const PORTFOLIO_MUTATION_STORAGE_KEY = "stockli:portfolio-mutated-at";

export function markPortfolioMutated(detail?: { portfolioId?: string }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PORTFOLIO_MUTATION_STORAGE_KEY, new Date().toISOString());
  window.dispatchEvent(new CustomEvent(PORTFOLIO_MUTATION_EVENT, { detail }));
}

export function isPortfolioCacheFresh<T>(record: CachedRecord<T>) {
  if (typeof window === "undefined") return true;
  const mutatedAt = window.localStorage.getItem(PORTFOLIO_MUTATION_STORAGE_KEY);
  if (!mutatedAt) return true;
  const savedTime = Date.parse(record.savedAt);
  const mutationTime = Date.parse(mutatedAt);
  if (!Number.isFinite(savedTime) || !Number.isFinite(mutationTime)) return true;
  return savedTime >= mutationTime;
}
