"use server";

import { redirect } from "next/navigation";
import { isDemoMode, config } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/validation";

export interface AuthState {
  error?: string;
  message?: string;
}

const DEMO_MSG =
  "Auth is disabled in demo mode. Add your Supabase keys to .env.local to enable sign-in.";

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many confirmation emails were requested. Please wait a few minutes before trying again, or sign in if your account is already confirmed.";
  }
  return message;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error.message) };

  redirect(safeRedirectPath(formData.get("redirectTo")));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split("@")[0] },
      emailRedirectTo: `${config.siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: authErrorMessage(error.message) };

  return {
    message:
      "Account created. Check your email to confirm your address, then sign in.",
  };
}

export async function signInWithGoogle(): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${config.siteUrl}/auth/callback` },
  });
  if (error) return { error: authErrorMessage(error.message) };
  if (data.url) redirect(data.url);
  return {};
}

export async function signOut(): Promise<void> {
  if (!isDemoMode) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
