"use server";

import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

/** Mark all notifications as seen for the current user (clears the unread badge). */
export async function markNotificationsSeen(): Promise<void> {
  if (isDemoMode) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles")
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq("id", user.id);
}
