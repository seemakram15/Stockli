"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/services/system-notifications";

export interface AdminActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const schema = z.object({
  userId: z.string().uuid(),
  makeAdmin: z.enum(["true", "false"]),
});

const broadcastSchema = z.object({
  type: z.enum(["SYSTEM", "MARKET", "PORTFOLIO", "ALERT"]),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(500).optional(),
  href: z.string().trim().max(200).optional(),
});

async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." as const };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "superadmin") return { error: "Forbidden." as const };

  return { user };
}

/**
 * Grant or revoke the superadmin role for a target user.
 *
 * Security:
 *  - Verifies the CALLER is a superadmin using THEIR session (not a client
 *    flag) before doing anything privileged.
 *  - Uses the service-role client only after that check.
 *  - Refuses to revoke the last remaining superadmin (lockout protection).
 *  - The DB trigger (0004) independently blocks non-superadmin role changes,
 *    so even a bypass of this action can't escalate privileges.
 */
export async function setUserRole(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (isDemoMode)
    return { error: "Demo mode — connect Supabase to manage roles." };

  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    makeAdmin: formData.get("makeAdmin"),
  });
  if (!parsed.success) return { error: "Invalid request." };
  const { userId } = parsed.data;
  const makeAdmin = parsed.data.makeAdmin === "true";

  // 1) Verify the caller is a superadmin from their own session.
  const auth = await requireSuperadmin();
  if ("error" in auth) return { error: auth.error };

  // 2) Privileged work via the service-role client.
  const admin = createAdminClient();

  if (!makeAdmin) {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "superadmin");
    if ((count ?? 0) <= 1) {
      return { error: "Cannot revoke the last remaining superadmin." };
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: makeAdmin ? "superadmin" : "user" })
    .eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message: makeAdmin ? "Superadmin granted." : "Superadmin revoked.",
  };
}

export async function sendBroadcastNotification(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (isDemoMode)
    return { error: "Demo mode — connect Supabase to send notifications." };

  const parsed = broadcastSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body"),
    href: formData.get("href"),
  });
  if (!parsed.success) return { error: "Please enter a valid notification." };

  const auth = await requireSuperadmin();
  if ("error" in auth) return { error: auth.error };

  const href = parsed.data.href?.trim();
  if (href && !href.startsWith("/")) {
    return { error: "Notification link must be an internal app path, like /market." };
  }

  const admin = createAdminClient();
  await createNotification(admin, {
    type: parsed.data.type,
    title: parsed.data.title,
    body: parsed.data.body?.trim() || null,
    href: href || "/dashboard",
  });

  revalidatePath("/admin");
  return {
    ok: true,
    message: "Notification sent to all users with in-app and push delivery where enabled.",
  };
}
