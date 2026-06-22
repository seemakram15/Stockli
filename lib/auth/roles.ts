import "server-only";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { DEMO_USER } from "@/lib/demo/data";

export type Role = "user" | "superadmin";

export interface SessionContext {
  user: { id: string; email: string | null; displayName: string | null } | null;
  role: Role;
}

/**
 * Combined session + role fetch — ONE auth.getUser() round-trip (instead of
 * calling getSessionUser and isSuperadmin separately). Used by the app shell.
 */
export async function getSessionContext(): Promise<SessionContext> {
  if (isDemoMode) {
    return {
      user: { id: DEMO_USER.id, email: DEMO_USER.email, displayName: DEMO_USER.displayName },
      role: "superadmin",
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: "user" };
  const { data } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();
  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      displayName: (data?.display_name as string) ?? (user.user_metadata?.display_name as string) ?? null,
    },
    role: (data?.role as Role) === "superadmin" ? "superadmin" : "user",
  };
}

/**
 * The current user's role, read server-side from the DB (never trusted from
 * the client). A user can read only their OWN profile row under RLS, so this
 * cannot be used to probe other users.
 *
 * In DEMO MODE there is no real auth, so the demo user is treated as a
 * superadmin purely so the admin UI is previewable.
 */
export async function getCurrentRole(): Promise<Role> {
  if (isDemoMode) return "superadmin";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "user";
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
