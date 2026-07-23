/** Client-safe helpers for the same-origin company icon cache. */

export const COMPANY_ICON_API_PREFIX = "/api/public/company-icons";

export function companyIconPath(symbol: string): string {
  return `${COMPANY_ICON_API_PREFIX}/${encodeURIComponent(symbol.trim().toUpperCase())}`;
}

/** Upstream AskAnalyst logo CDN used when warming / proxying icons. */
export function askAnalystLogoUrl(symbol: string): string {
  return `https://admin.askanalyst.com.pk/logo16/${symbol.trim().toUpperCase()}.svg`;
}
