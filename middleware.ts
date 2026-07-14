import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAllowedPublicApiRequest } from "@/lib/security/api-guard";

// Unauthenticated data routes — no session/secret to check, so they're
// gated by request origin instead (see lib/security/api-guard.ts).
const PUBLIC_DATA_API_PREFIXES = ["/api/public/", "/api/search"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_DATA_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isAllowedPublicApiRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets:
     * - _next/static, _next/image, favicon, public files
     * - api routes are protected individually (cron secret etc.), except
     *   the public data routes explicitly matched below for origin-gating
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    "/api/public/:path*",
    "/api/search",
  ],
};
