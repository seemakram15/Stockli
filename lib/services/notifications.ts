import "server-only";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { DEMO_NOTIFICATIONS } from "@/lib/demo/data";
import type { AppNotification } from "@/lib/types";

export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}

/** Recent notifications (own + global) + unread count for the current user. */
export async function getNotifications(): Promise<NotificationFeed> {
  if (isDemoMode) {
    return { items: DEMO_NOTIFICATIONS, unread: 2 };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], unread: 0 };

  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("profiles").select("notifications_seen_at").eq("id", user.id).maybeSingle(),
  ]);

  const list = (items as AppNotification[] | null) ?? [];
  const seenAt = (profile?.notifications_seen_at as string) ?? "1970-01-01T00:00:00Z";
  const unread = list.filter((n) => n.created_at > seenAt).length;
  return { items: list, unread };
}
