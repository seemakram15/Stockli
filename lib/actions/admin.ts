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
  redirectTo?: string;
}

const schema = z.object({
  userId: z.string().uuid(),
  makeAdmin: z.enum(["true", "false"]),
});

const broadcastSchema = z.object({
  type: z.enum(["SYSTEM", "MARKET", "PORTFOLIO", "ALERT"]),
  title: z
    .string()
    .trim()
    .min(2, "Title should be at least 2 characters.")
    .max(120, "Title should stay under 120 characters."),
  body: z.string().trim().max(500).optional(),
  href: z.string().trim().max(200).optional(),
});

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.string().trim().min(1).max(200),
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
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please enter a valid notification.",
    };
  }

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

export async function deleteUserAccount(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  if (isDemoMode)
    return { error: "Demo mode — connect Supabase to manage user accounts." };

  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const auth = await requireSuperadmin();
  if ("error" in auth) return { error: auth.error };

  const { userId, confirmation } = parsed.data;
  if (auth.user.id === userId) {
    return {
      error:
        "Use your own Account settings page to delete yourself. Superadmin user deletion is only for other users.",
    };
  }

  const admin = createAdminClient();
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, display_name, role")
      .eq("id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);

  if (!profile || !authUser.user) {
    return { error: "This user account could not be found anymore." };
  }

  const expectedConfirmation = (authUser.user.email ?? userId).trim().toLowerCase();
  if (confirmation.trim().toLowerCase() !== expectedConfirmation) {
    return {
      error: `Type ${expectedConfirmation} exactly to confirm permanent deletion.`,
    };
  }

  if (profile.role === "superadmin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "superadmin");
    if ((count ?? 0) <= 1) {
      return { error: "Cannot delete the last remaining superadmin." };
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return {
      error: "We could not delete that account right now. Please try again in a minute.",
    };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message: `${profile.display_name ?? authUser.user.email ?? "User"} was deleted successfully.`,
    redirectTo: "/admin",
  };
}
