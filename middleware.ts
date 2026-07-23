import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAllowedPublicApiRequest, isKnownScraper } from "@/lib/security/api-guard";
import { edgeRateLimit } from "@/lib/security/edge-rate-limit";

// Public data routes: no session required but gated by origin + rate limit.
const PUBLIC_DATA_API_PREFIXES = ["/api/public/", "/api/search"];

/**
 * Rate limits are sized for real app usage (RSC navigations, SWR, warmup),
 * not bare “one click = one request”. Prefetch traffic is skipped separately.
 *
 * Guest browsing stays protected from scrapers; signed-in users get more headroom.
 */
const RATE_LIMITS = {
  pages: { guest: 240, auth: 480, window: 60 },
  public: { guest: 240, auth: 480, window: 60 },
  prices: { guest: 120, auth: 240, window: 60 },
  search: { guest: 120, auth: 240, window: 60 },
} as const;

function looksAuthenticated(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.includes("-auth-token") ||
        (cookie.name.startsWith("sb-") && cookie.value.length > 0)
    );
}

function isRouterPrefetch(request: NextRequest): boolean {
  const purpose = request.headers.get("purpose") ?? request.headers.get("sec-purpose") ?? "";
  if (/prefetch/i.test(purpose)) return true;
  if (request.headers.get("Next-Router-Prefetch") === "1") return true;
  if (request.headers.get("next-router-prefetch") === "1") return true;
  if (request.headers.get("x-middleware-prefetch") === "1") return true;
  return false;
}

function limitFor(
  kind: keyof typeof RATE_LIMITS,
  request: NextRequest
): { limit: number; window: number } {
  const rule = RATE_LIMITS[kind];
  return {
    limit: looksAuthenticated(request) ? rule.auth : rule.guest,
    window: rule.window,
  };
}

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + retryAfter),
      },
    }
  );
}

function blockedPageResponse(status: 429 | 403, retryAfter?: number) {
  const html =
    status === 429
      ? `<!doctype html><meta charset=utf-8><title>Too many requests</title><p style="font-family:sans-serif;padding:2rem">Too many requests — please wait a moment before continuing.</p>`
      : `<!doctype html><meta charset=utf-8><title>Access denied</title><p style="font-family:sans-serif;padding:2rem">Access denied.</p>`;
  const headers: Record<string, string> = { "Content-Type": "text/html; charset=utf-8" };
  if (retryAfter) {
    headers["Retry-After"] = String(retryAfter);
    headers["X-RateLimit-Reset"] = String(Math.floor(Date.now() / 1000) + retryAfter);
  }
  return new NextResponse(html, { status, headers });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ua = request.headers.get("user-agent") ?? "";
  const isGooglebot = /googlebot|google-inspectiontool|adsbot-google|mediapartners-google/i.test(
    ua
  );

  // Always let search engines fetch crawl policy + sitemap (GSC validators
  // often use non-browser UAs that would otherwise hit the scraper block).
  if (pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname === "/sitemap" || pathname === "/llms.txt") {
    return NextResponse.next();
  }

  // ── Block known scraper UAs on every route — pages and APIs alike ─────────
  if (isKnownScraper(ua) && !isGooglebot) {
    const isPage = !pathname.startsWith("/api/");
    return isPage
      ? blockedPageResponse(403)
      : NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Router prefetch should not burn a normal user's browsing budget.
  const skipRateLimit = isGooglebot || isRouterPrefetch(request);

  // ── Public data API routes (origin-gated + rate limited) ──────────────────
  if (PUBLIC_DATA_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    // Googlebot rendering may fetch public JSON without browser Sec-Fetch headers.
    if (!isGooglebot && !isAllowedPublicApiRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!skipRateLimit) {
      const kind = pathname.startsWith("/api/search")
        ? "search"
        : pathname.startsWith("/api/public/")
          ? "public"
          : null;
      if (kind) {
        const { limit, window } = limitFor(kind, request);
        const result = await edgeRateLimit(request, kind, limit, window);
        if (!result.allowed) return tooManyRequests(result.retryAfter);
      }
    }
    return NextResponse.next();
  }

  // ── Prices endpoint (authenticated pages, live polling) ───────────────────
  if (pathname.startsWith("/api/prices")) {
    if (!skipRateLimit) {
      const { limit, window } = limitFor("prices", request);
      const result = await edgeRateLimit(request, "prices", limit, window);
      if (!result.allowed) return tooManyRequests(result.retryAfter);
    }
    return NextResponse.next();
  }

  // ── Page routes — rate limited to stop bulk HTML scraping ─────────────────
  if (!skipRateLimit) {
    const { limit, window } = limitFor("pages", request);
    const pageRateLimit = await edgeRateLimit(request, "pages", limit, window);
    if (!pageRateLimit.allowed) return blockedPageResponse(429, pageRateLimit.retryAfter);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    "/api/public/:path*",
    "/api/search",
    "/api/prices",
  ],
};
