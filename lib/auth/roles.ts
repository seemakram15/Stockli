import "server-only";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/auth/current-user";
import { DEMO_USER } from "@/lib/demo/data";
import { getProfileAvatarUrl } from "@/lib/profile-avatar";

export type Role = "user" | "superadmin";

export interface SessionContext {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  role: Role;
}

/**
 * Combined session + role fetch — ONE auth.getUser() round-trip (instead of
 * calling getSessionUser and isSuperadmin separately). Used by the app shell.
 */
export async function getSessionContext(): Promise<SessionContext> {
  if (isDemoMode) {
    return {
      user: {
        id: DEMO_USER.id,
        email: DEMO_USER.email,
        displayName: DEMO_USER.displayName,
        avatarUrl: null,
      },
      role: "user",
    };
  }
  const user = await getRequestUser();
  if (!user) return { user: null, role: "user" };
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
  };
}

/**
 * The current user's role, read server-side from the DB (never trusted from
 * the client). A user can read only their OWN profile row under RLS, so this
 * cannot be used to probe other users.
 *
 * In DEMO MODE there is no real auth, so admin capabilities stay disabled.
 */
export async function getCurrentRole(): Promise<Role> {
  if (isDemoMode) return "user";
  const user = await getRequestUser();
  if (!user) return "user";
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.role as Role) === "superadmin" ? "superadmin" : "user";
}

export async function isSuperadmin(): Promise<boolean> {
  return (await getCurrentRole()) === "superadmin";
}

/**
 * Page-level guard. Renders a 404 (not a 403) for non-superadmins so the
 * existence of the admin area isn't revealed.
 */
export async function requireSuperadmin(): Promise<void> {
  if (!(await isSuperadmin())) notFound();
}
