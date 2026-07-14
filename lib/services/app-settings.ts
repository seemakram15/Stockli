import "server-only";
import { isDemoMode } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaleCached, invalidateStaleCache } from "@/lib/cache/stale";
import { requireSuperadmin } from "@/lib/auth/superadmin";
import { getRequestUser } from "@/lib/auth/current-user";

const SETTINGS_CACHE_KEY = "app-settings:v1";

export const GUEST_BROWSING_KEY = "guest_browsing_enabled";
export const GUEST_POPUP_KEY = "guest_login_popup_enabled";
const PAGE_KEY_PREFIX = "page:";

export interface AppSettings {
  guestBrowsingEnabled: boolean;
  guestPopupEnabled: boolean;
  isPageEnabled: (key: string) => boolean;
  raw: Record<string, boolean>;
}

function fromRaw(raw: Record<string, boolean>): AppSettings {
  return {
    guestBrowsingEnabled: raw[GUEST_BROWSING_KEY] ?? true,
    guestPopupEnabled: raw[GUEST_POPUP_KEY] ?? true,
    isPageEnabled: (key: string) => raw[`${PAGE_KEY_PREFIX}${key}`] ?? true,
    raw,
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  if (isDemoMode) {
    // No real backend to query — demo mode is already fully open.
    return fromRaw({ [GUEST_BROWSING_KEY]: true, [GUEST_POPUP_KEY]: false });
  }

  const { value } = await getStaleCached<Record<string, boolean>>({
    key: SETTINGS_CACHE_KEY,
    ttlSeconds: 15,
    staleSeconds: 120,
    load: async () => {
      const db = createAdminClient();
      const { data } = await db.from("app_settings").select("key, enabled");
      return Object.fromEntries((data ?? []).map((row) => [row.key, row.enabled]));
    },
  });

  return fromRaw(value);
}

/** Superadmin-only. Updates a single setting row and busts the shared cache. */
export async function updateAppSetting(key: string, enabled: boolean): Promise<void> {
  await requireSuperadmin();
  const user = await getRequestUser();
  const db = createAdminClient();
  await db.from("app_settings").upsert({
    key,
    enabled,
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
  });
  await invalidateStaleCache(SETTINGS_CACHE_KEY);
}

export function pageSettingKey(pageKey: string): string {
  return `${PAGE_KEY_PREFIX}${pageKey}`;
}
