import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions. Reads/writes the auth session via Next.js cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore; the session is
          // refreshed by middleware instead.
        }
      },
    },
  });
}
