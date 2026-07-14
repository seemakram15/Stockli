import "server-only";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { getRequestUser } from "@/lib/auth/current-user";
import type { Role } from "@/lib/auth/roles";

/**
 * The current user's role, read server-side from the DB (never trusted from
 * the client). A user can read only their OWN profile row under RLS, so this
 * cannot be used to probe other users.
 *
 * In DEMO MODE there is no real auth, so admin capabilities stay disabled.
 *
 * Deliberately kept in its own module (not lib/auth/roles.ts) so services
 * that need a superadmin check — like lib/services/app-settings.ts — don't
 * create an import cycle with getSessionContext().
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
