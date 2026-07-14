import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/auth/current-user";
import { DEMO_USER, GUEST_USER } from "@/lib/demo/data";
import { getProfileAvatarUrl } from "@/lib/profile-avatar";
import { getVapidPublicKey } from "@/lib/services/push-notifications";
import { PAGE_REGISTRY, resolvePageKey } from "@/lib/access/page-registry";
import { getAppSettings } from "@/lib/services/app-settings";

export { getCurrentRole, isSuperadmin, requireSuperadmin } from "@/lib/auth/superadmin";

export type Role = "user" | "superadmin";
export type NotificationConsentStatus = "unknown" | "granted" | "denied";

export interface SessionContext {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  role: Role;
  consent: {
    vapidPublicKey: string | null;
    cookieConsentAt: string | null;
    notificationStatus: NotificationConsentStatus;
  };
  /** True only for a synthesized unauthenticated "browse with sample data" session. */
  isGuest: boolean;
  /** Per-page enabled map for nav lock icons; only populated when isGuest. */
  guestPageAccess: Record<string, boolean> | null;
  guestPopupEnabled: boolean;
}

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const vapidPublicKey = getVapidPublicKey();
  if (isDemoMode) {
    return {
      user: {
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        displayName: DEMO_USER.displayName,
        avatarUrl: null,
      },
      role: "user",
      consent: { vapidPublicKey, cookieConsentAt: null, notificationStatus: "unknown" },
      isGuest: false,
      guestPageAccess: null,
      guestPopupEnabled: false,
    };
  }
  const user = await getRequestUser();
  if (!user) {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") ?? "";
    const pageKey = resolvePageKey(pathname);
    const settings = await getAppSettings();

    // Middleware doesn't run on /api routes, so client-side data fetches
    // arrive with no x-pathname at all. In that case there's no page to
    // gate on — the specific page's access was already enforced when its
    // Server Component rendered, so just defer to the master switch. A
    // real (non-API) page whose path isn't in the registry (e.g. /account,
    // /admin) always falls through to the real-login branch below.
    const eligible =
      pathname === ""
        ? settings.guestBrowsingEnabled
        : Boolean(pageKey) && settings.guestBrowsingEnabled && settings.isPageEnabled(pageKey!);

    if (eligible) {
      const guestPageAccess = Object.fromEntries(
        PAGE_REGISTRY.map((entry) => [entry.key, settings.isPageEnabled(entry.key)])
      );
      return {
        user: {
          id: GUEST_USER.id,
          email: GUEST_USER.email,
          displayName: GUEST_USER.displayName,
          avatarUrl: null,
        },
        role: "user",
        consent: { vapidPublicKey, cookieConsentAt: null, notificationStatus: "denied" },
        isGuest: true,
        guestPageAccess,
        guestPopupEnabled: settings.guestPopupEnabled,
      };
    }

    return {
      user: null,
      role: "user",
      consent: { vapidPublicKey, cookieConsentAt: null, notificationStatus: "unknown" },
      isGuest: false,
      guestPageAccess: null,
      guestPopupEnabled: false,
    };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profileAvatarPath =
    data && typeof data === "object" && "avatar_path" in data && typeof data.avatar_path === "string"
      ? data.avatar_path
      : null;
  const metadataAvatarPath =
    user.user_metadata && typeof user.user_metadata.avatar_path === "string"
      ? user.user_metadata.avatar_path
      : null;

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: (data?.display_name as string) ?? (user.user_metadata?.display_name as string) ?? null,
      avatarUrl:
        getProfileAvatarUrl(profileAvatarPath ?? metadataAvatarPath) ??
        ((user.user_metadata?.avatar_url as string) ?? null),
    },
    role: (data?.role as Role) === "superadmin" ? "superadmin" : "user",
    consent: {
      vapidPublicKey,
      cookieConsentAt: (data?.cookie_consent_at as string | null) ?? null,
      notificationStatus: ((data?.notification_consent_status as NotificationConsentStatus | null) ?? "unknown"),
    },
    isGuest: false,
    guestPageAccess: null,
    guestPopupEnabled: false,
  };
});

/**
 * True when the current request should be served sample/fixture data
 * instead of live data — either the whole deployment is in demo mode, or
 * this specific request is an unauthenticated guest browsing a
 * guest-enabled page. Real logged-in users always get `false`.
 */
export const isSampleMode = cache(async (): Promise<boolean> => {
  if (isDemoMode) return true;
  const { isGuest } = await getSessionContext();
  return isGuest;
});
