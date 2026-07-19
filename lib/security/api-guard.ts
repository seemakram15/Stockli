import type { NextRequest } from "next/server";

// User-agent fragments that indicate non-browser automated clients.
// Real browsers never identify as these — blocking them costs nothing.
const BOT_UA_PATTERNS = [
  "python-requests",
  "python-httpx",
  "python-urllib",
  "go-http-client",
  "java/",
  "jakarta commons",
  "apache-httpclient",
  "libwww-perl",
  "lwp-trivial",
  "curl/",
  "wget/",
  "scrapy",
  "node-fetch",
  "axios/",
  "got/",
  "aiohttp/",
  "httpx/",
  "mechanize",
  "okhttp",
  "php-curl",
  "perl/",
  "ruby",
  "nmap",
  "masscan",
];

export function isKnownScraper(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_UA_PATTERNS.some((p) => lower.includes(p));
}

/**
 * True when a request to one of our own public (unauthenticated) API routes
 * looks like it came from our own site in a real browser.
 *
 * Three-layer check:
 * 1. Block known scraper user-agents immediately.
 * 2. Trust Sec-Fetch-Site (browser-injected, cannot be set by same-origin JS).
 * 3. Fall back to Origin/Referer host matching for older browsers.
 *
 * Requests with none of the above headers (curl, scripts) are rejected.
 */
export function isAllowedPublicApiRequest(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (isKnownScraper(ua)) return false;

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    return (
      secFetchSite === "same-origin" ||
      secFetchSite === "same-site" ||
      secFetchSite === "none"
    );
  }

  const host = request.nextUrl.host;
  const origin = request.headers.get("origin");
  if (origin) return safeHost(origin) === host;

  const referer = request.headers.get("referer");
  if (referer) return safeHost(referer) === host;

  return false;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
