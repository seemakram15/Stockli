"use server";

import { redirect } from "next/navigation";
import { isDemoMode, config } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/validation";

export interface AuthState {
  error?: string;
  message?: string;
  email?: string;
  nextStep?: "confirm-signup" | "reset-email-sent" | "password-reset-complete";
}

const DEMO_MSG =
  "Auth is disabled in demo mode. Add your Supabase keys to .env.local to enable sign-in.";

function authErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Too many confirmation emails were requested. Please wait a few minutes before trying again, or sign in if your account is already confirmed.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Please confirm your email first. Check your inbox and click the confirmation link before signing in.";
  }
  if (normalized.includes("user already registered")) {
    return "This email is already registered. Try signing in or reset your password if you forgot it.";
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
    email,
    message:
      "We emailed your confirmation link. Open it to activate your account and continue securely.",
    nextStep: "confirm-signup",
  };
}

export async function resendSignupConfirmation(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required.", nextStep: "confirm-signup" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${config.siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return {
      error: authErrorMessage(error.message),
      email,
      nextStep: "confirm-signup",
    };
  }

  return {
    email,
    message: "A fresh confirmation email is on the way.",
    nextStep: "confirm-signup",
  };
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${config.siteUrl}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: authErrorMessage(error.message), email };

  return {
    email,
    message:
      "If that email is registered, we just sent a password reset link. Open it on the same device or browser to continue.",
    nextStep: "reset-email-sent",
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (!password || !confirmPassword) {
    return { error: "Enter and confirm your new password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "This reset link is invalid or expired. Request a fresh password reset email.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: authErrorMessage(error.message) };

  return {
    message: "Password updated successfully. You can continue to your dashboard now.",
    nextStep: "password-reset-complete",
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
