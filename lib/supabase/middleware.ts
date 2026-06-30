import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { config, isDemoMode } from "@/lib/config";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/portfolios",
  "/watchlist",
  "/market",
  "/alerts",
  "/stock",
  "/search",
  "/admin",
];

const MODAL_AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

/**
 * Refreshes the Supabase auth session on every request and enforces
 * route protection. In DEMO MODE (no real Supabase keys) auth is skipped
 * so the full app remains navigable with sample data.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Demo mode: no auth backend — let everything through.
  if (isDemoMode) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = MODAL_AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Unauthenticated visitor hitting a gated app route → dedicated sign-in screen
  // (with a redirectTo so we can return them where they were headed).
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    const redirectTo = `${pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", redirectTo);
    return NextResponse.redirect(url);
  }

  // Already signed in but visiting an auth screen → straight to the dashboard.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Auth screens (/login, /signup, /forgot-password) now render as real pages
  // for signed-out visitors — no modal redirect.
  return supabaseResponse;
}
