import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAllowedPublicApiRequest, isKnownScraper } from "@/lib/security/api-guard";
import { edgeRateLimit } from "@/lib/security/edge-rate-limit";

// Public data routes: no session required but gated by origin + rate limit.
const PUBLIC_DATA_API_PREFIXES = ["/api/public/", "/api/search"];

// Rate limits — chosen so normal browsing never comes close.
//   pages:  60/min → a heavy user clicks ~10–15 pages/min; scraper hits hundreds
//   public: 80/min → market page loads ~3–5 API calls; scraper polls continuously
//   prices: 20/min → SWR polls every 30 s = 2/min per tab
//   search: 40/min → debounced typing = ~10/min
const RATE_LIMITS: { prefix: string; scope: string; limit: number; window: number }[] = [
  { prefix: "/api/prices",  scope: "prices", limit: 20, window: 60 },
  { prefix: "/api/public/", scope: "public", limit: 80, window: 60 },
  { prefix: "/api/search",  scope: "search", limit: 40, window: 60 },
];

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

  // ── Block known scraper UAs on every route — pages and APIs alike ─────────
  if (isKnownScraper(ua)) {
    const isPage = !pathname.startsWith("/api/");
    return isPage
      ? blockedPageResponse(403)
      : NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Public data API routes (origin-gated + rate limited) ──────────────────
  if (PUBLIC_DATA_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAllowedPublicApiRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rule = RATE_LIMITS.find((r) => pathname.startsWith(r.prefix));
    if (rule) {
      const result = await edgeRateLimit(request, rule.scope, rule.limit, rule.window);
      if (!result.allowed) return tooManyRequests(result.retryAfter);
    }
    return NextResponse.next();
  }

  // ── Prices endpoint (authenticated pages, live polling) ───────────────────
  if (pathname.startsWith("/api/prices")) {
    const result = await edgeRateLimit(request, "prices", 20, 60);
    if (!result.allowed) return tooManyRequests(result.retryAfter);
    return NextResponse.next();
  }

  // ── Page routes — rate limited to stop bulk HTML scraping ─────────────────
  const pageRateLimit = await edgeRateLimit(request, "pages", 60, 60);
  if (!pageRateLimit.allowed) return blockedPageResponse(429, pageRateLimit.retryAfter);

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
