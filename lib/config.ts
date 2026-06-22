/**
 * Centralised configuration + "is this service actually wired up?" detection.
 *
 * The app ships with DUMMY env values so the entire flow is navigable in
 * DEMO MODE. A value is considered "real" only if it is present and does not
 * look like one of the documented placeholders. When a service is not
 * configured, the data layer transparently falls back to sample data.
 */

function looksReal(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  if (v === "") return false;
  const placeholders = ["demo", "your-project", "your_", "your-db", "change-me"];
  return !placeholders.some((p) => v.includes(p));
}

export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  upstash: {
    url: process.env.UPSTASH_REDIS_REST_URL ?? "",
    token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  },
  cronSecret: process.env.CRON_SECRET ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  psx: {
    baseUrl: process.env.PSX_DPS_BASE_URL ?? "https://dps.psx.com.pk",
  },
} as const;

/** True when real Supabase credentials are present. */
export const isSupabaseConfigured =
  looksReal(config.supabase.url) && looksReal(config.supabase.anonKey);

/** True when real Upstash credentials are present. */
export const isUpstashConfigured =
  looksReal(config.upstash.url) && looksReal(config.upstash.token);

/** Service-role key present (server-only privileged writes). */
export const isSupabaseAdminConfigured =
  isSupabaseConfigured && looksReal(config.supabase.serviceRoleKey);

/** When true, the app serves sample data and disables auth enforcement. */
export const isDemoMode = !isSupabaseConfigured;
