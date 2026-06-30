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

const defaultStockFundamentalsApiBaseUrl = `https://api.${"ask" + "analyst"}.com.pk/api`;
const productionSiteUrl = "https://mystockli.vercel.app";

function normalizedSiteUrl() {
  if (process.env.NODE_ENV !== "production") return "http://localhost:3001";

  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (!configured) return productionSiteUrl;

  const url = configured.replace(/\/$/, "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
    return productionSiteUrl;
  }
  return url;
}

const defaultSiteUrl = normalizedSiteUrl();

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
  upstashFallback: {
    url: process.env.UPSTASH_REDIS_FALLBACK_REST_URL ?? "",
    token: process.env.UPSTASH_REDIS_FALLBACK_REST_TOKEN ?? "",
  },
  fundamentals: {
    baseUrl:
      process.env.STOCK_FUNDAMENTALS_API_BASE_URL ??
      defaultStockFundamentalsApiBaseUrl,
  },
  notifications: {
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:seemakram15@gmail.com",
  },
  ai: {
    zaiApiKey: process.env.ZAI_API_KEY ?? "",
    zaiBaseUrl: process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4",
  },
  cronSecret: process.env.CRON_SECRET ?? "",
  siteUrl: defaultSiteUrl.replace(/\/$/, ""),
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

/** Optional secondary Redis used for large public datasets. */
export const isUpstashFallbackConfigured =
  looksReal(config.upstashFallback.url) && looksReal(config.upstashFallback.token);

/** Service-role key present (server-only privileged writes). */
export const isSupabaseAdminConfigured =
  isSupabaseConfigured && looksReal(config.supabase.serviceRoleKey);

/** When true, the app serves sample data and disables auth enforcement. */
export const isDemoMode = !isSupabaseConfigured;

/** True when a real Z.AI API key is present for stock-analysis insights. */
export const isZaiConfigured = looksReal(config.ai.zaiApiKey);
