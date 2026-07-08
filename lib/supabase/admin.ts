import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Privileged, service-role client. Server-only — NEVER import into client
 * components. Bypasses RLS, so use it solely for trusted background jobs
 * (price-snapshot writes, daily P/L, ticker seeding) in cron routes.
 */
export function createAdminClient() {
  return createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
