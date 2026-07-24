import "server-only";
import { isDemoMode } from "@/lib/config";

/** Canonical production host for demo/local public-data fallbacks. */
export const PRODUCTION_SITE_URL = "https://mystockli.com";

/**
 * Only use remote production snapshots when running locally/demo without a
 * real Supabase project. Never pull remote into Vercel production.
 */
export function canUseProductionPublicFallback(): boolean {
  return isDemoMode && process.env.VERCEL_ENV !== "production";
}

type FetchProductionOptions<T> = {
  /** Path after origin, e.g. `/api/public/mufap`. */
  path: string;
  /** Browser-like Referer path on mystockli.com (origin-gate friendly). */
  refererPath?: string;
  /** Reject empty / unusable payloads so callers can soft-fail. */
  isUsable?: (data: T) => boolean;
  /** Next.js fetch cache hint. */
  revalidateSeconds?: number;
  label?: string;
};

/**
 * Fetch `{ data: T }` from production public APIs with browser-like headers
 * so anti-scraper / origin gates accept the request.
 */
export async function fetchProductionPublicData<T>({
  path,
  refererPath = "/market",
  isUsable = (data) => data != null,
  revalidateSeconds = 300,
  label = "production-public",
}: FetchProductionOptions<T>): Promise<T | null> {
  if (!canUseProductionPublicFallback()) return null;

  const url = `${PRODUCTION_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; MyStockliLocal/1.0; +https://mystockli.com)",
        Origin: PRODUCTION_SITE_URL,
        Referer: `${PRODUCTION_SITE_URL}${refererPath.startsWith("/") ? refererPath : `/${refererPath}`}`,
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
      },
      next: { revalidate: revalidateSeconds },
    });
    if (!response.ok) {
      console.warn(`[${label}] production fallback HTTP ${response.status} for ${path}`);
      return null;
    }
    const payload = (await response.json()) as { data?: T };
    const data = payload.data;
    if (data == null || !isUsable(data)) return null;
    return data;
  } catch (error) {
    console.warn(`[${label}] production fallback failed for ${path}:`, error);
    return null;
  }
}
