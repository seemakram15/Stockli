import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseAdminConfigured } from "@/lib/config";

/**
 * Privileged, service-role client. Server-only — NEVER import into client
 * components. Bypasses RLS, so use it solely for trusted background jobs
 * (price-snapshot writes, daily P/L, ticker seeding) in cron routes.
 */
export function createAdminClient() {
  if (!isSupabaseAdminConfigured) {
    throw new Error(
      "Supabase admin client is not configured (demo mode or missing service role key)."
    );
  }
  return createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
