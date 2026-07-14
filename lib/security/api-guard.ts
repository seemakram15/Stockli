import type { NextRequest } from "next/server";

/**
 * True when a request to one of our own public (unauthenticated) API routes
 * looks like it came from our own site in a real browser — blocks both
 * browser-JS calls from another origin (a clone site embedding our API) and
 * bare server-to-server/script calls (curl, scrapers), which send neither
 * Sec-Fetch-Site nor a matching Origin/Referer.
 *
 * `Sec-Fetch-Site` is a browser-generated Fetch Metadata header that pages
 * cannot override via JS — every modern browser (Chrome/Edge/Firefox/Safari
 * 15.4+) sends it on every request. Origin/Referer are a fallback for the
 * rare older browser that lacks it; if none of the three are present at all,
 * the request isn't a normal same-site browser call, so it's rejected.
 */
export function isAllowedPublicApiRequest(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    return secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none";
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
