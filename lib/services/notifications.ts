import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSampleMode } from "@/lib/auth/roles";
import { DEMO_NOTIFICATIONS } from "@/lib/demo/data";
import type { AppNotification } from "@/lib/types";

export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}

/** Recent notifications (own + global) + unread count for the current user. */
export async function getNotifications(): Promise<NotificationFeed> {
  if (await isSampleMode()) {
    return { items: DEMO_NOTIFICATIONS, unread: 2 };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], unread: 0 };

  const [{ data: ownItems }, { data: globalItems }, { data: profile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("notifications")
      .select("*")
      .is("user_id", null)
      .gte("created_at", user.created_at)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("profiles").select("notifications_seen_at").eq("id", user.id).maybeSingle(),
  ]);

  const list = [
    ...((ownItems as AppNotification[] | null) ?? []),
    ...((globalItems as AppNotification[] | null) ?? []),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 30);
  const seenAt = (profile?.notifications_seen_at as string) ?? "1970-01-01T00:00:00Z";
  const unread = list.filter((n) => n.created_at > seenAt).length;
  return { items: list, unread };
}
