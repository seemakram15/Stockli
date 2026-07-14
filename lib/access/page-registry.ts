/**
 * Registry of every nav-reachable page, used to decide (a) whether a guest
 * (unauthenticated visitor) may reach it at all, and (b) whether it should
 * render real data ("open") or sample/dummy data ("dummy") for a guest.
 *
 * Derived from the existing nav constants so new nav entries don't need a
 * second source of truth — only genuinely new classification (dummy vs
 * open) needs a manual decision when a page is added here.
 *
 * `/account` and `/admin*` are deliberately NOT registered: an unresolved
 * pathname always falls through to the real-login gate, so those routes
 * can never be guest-synthesized regardless of settings.
 */

import { EXPLORE_NAV_ITEMS, MARKET_NAV_ITEMS, NAV_ITEMS, TOOL_NAV_ITEMS } from "@/lib/constants";

export type PageKind = "open" | "dummy";

export interface PageRegistryEntry {
  key: string;
  href: string;
  label: string;
  kind: PageKind;
}

const DUMMY_HREFS = new Set(["/dashboard", "/portfolios", "/watchlist", "/alerts"]);

function toKey(href: string): string {
  return href.replace(/^\//, "").replace(/\//g, "-");
}

function buildRegistry(): PageRegistryEntry[] {
  const byHref = new Map<string, PageRegistryEntry>();

  function add(href: string, label: string) {
    if (byHref.has(href)) return;
    byHref.set(href, {
      key: toKey(href),
      href,
      label,
      kind: DUMMY_HREFS.has(href) ? "dummy" : "open",
    });
  }

  for (const item of NAV_ITEMS) add(item.href, item.label);

  for (const item of MARKET_NAV_ITEMS) {
    if ("children" in item) {
      for (const child of item.children) add(child.href, child.label);
    } else {
      add(item.href, item.label);
    }
  }

  for (const item of TOOL_NAV_ITEMS) add(item.href, item.label);
  for (const item of EXPLORE_NAV_ITEMS) add(item.href, item.label);

  // Not present in any nav array, but reachable and should stay public.
  add("/stock", "Stock Detail");
  add("/search", "Search");

  return Array.from(byHref.values());
}

export const PAGE_REGISTRY: PageRegistryEntry[] = buildRegistry();

/** Longest-prefix match so dynamic routes (e.g. /portfolios/abc) resolve to their parent entry. */
export function resolvePageKey(pathname: string): string | null {
  let best: PageRegistryEntry | null = null;
  for (const entry of PAGE_REGISTRY) {
    const matches = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
    if (matches && (!best || entry.href.length > best.href.length)) {
      best = entry;
    }
  }
  return best?.key ?? null;
}

export function getPageEntry(key: string): PageRegistryEntry | undefined {
  return PAGE_REGISTRY.find((entry) => entry.key === key);
}
