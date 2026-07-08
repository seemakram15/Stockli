"use server";

import { redirect } from "next/navigation";
import { isDemoMode, isSupabaseAdminConfigured } from "@/lib/config";
import {
  enforceRateLimit,
  formatRetryAfter,
  getRequestClientIp,
  rateLimitKeyPart,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/security/validation";
import { resolveRequestSiteUrl } from "@/lib/site-url";

export interface AuthState {
  error?: string;
  message?: string;
  email?: string;
  nextStep?: "confirm-signup" | "reset-email-sent" | "password-reset-complete";
}

export interface DeleteAccountState {
  error?: string;
}

const DEMO_MSG =
  "Auth is disabled in demo mode. Add your Supabase keys to .env.local to enable sign-in.";

const LOGIN_WINDOW_SECONDS = 10 * 60;
const EMAIL_FLOW_WINDOW_SECONDS = 30 * 60;
const DELETE_ACCOUNT_WINDOW_SECONDS = 60 * 60;

type AuthErrorLike =
  | string
  | {
      message?: string;
      status?: number;
      name?: string;
    }
  | null
  | undefined;

function authErrorMessage(error: AuthErrorLike) {
  const message = typeof error === "string" ? error : error?.message ?? "";
  const status = typeof error === "object" && error ? error.status : undefined;
  const normalized = message.toLowerCase();
  if (!message || normalized === "{}" || normalized === "internal server error") {
    return "We could not send the authentication email right now. Please try again in a minute. If it keeps happening, our email delivery settings need attention.";
  }
  if (status && status >= 500) {
    return "We could not complete that auth request right now. Please try again in a minute.";
  }
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

async function resolveAuthSiteUrl() {
  return resolveRequestSiteUrl();
}

function buildLoginUrl(
  siteUrl: string,
  message: string,
  email?: string | null,
  options?: { accountDeleted?: boolean }
) {
  const loginUrl = new URL("/login", siteUrl);
  loginUrl.searchParams.set("authMessage", message);
  if (email) loginUrl.searchParams.set("authEmail", email);
  if (options?.accountDeleted) loginUrl.searchParams.set("accountDeleted", "1");
  return loginUrl.toString();
}

async function checkAuthRateLimit(
  action: "login" | "signup" | "resend-signup" | "forgot-password",
  email: string
) {
  const ip = await getRequestClientIp();

  switch (action) {
    case "login":
      return enforceRateLimit({
        scope: "auth:login",
        windowSeconds: LOGIN_WINDOW_SECONDS,
        buckets: [
          { key: `ip:${rateLimitKeyPart(ip)}`, limit: 20 },
          { key: `ip-email:${rateLimitKeyPart(`${ip}:${email}`)}`, limit: 6 },
        ],
      });
    case "signup":
      return enforceRateLimit({
        scope: "auth:signup",
        windowSeconds: EMAIL_FLOW_WINDOW_SECONDS,
        buckets: [
          { key: `ip:${rateLimitKeyPart(ip)}`, limit: 8 },
          { key: `email:${rateLimitKeyPart(email)}`, limit: 3 },
        ],
      });
    case "resend-signup":
      return enforceRateLimit({
        scope: "auth:resend-signup",
        windowSeconds: EMAIL_FLOW_WINDOW_SECONDS,
        buckets: [
          { key: `ip:${rateLimitKeyPart(ip)}`, limit: 10 },
          { key: `email:${rateLimitKeyPart(email)}`, limit: 4 },
        ],
      });
    case "forgot-password":
      return enforceRateLimit({
        scope: "auth:forgot-password",
        windowSeconds: EMAIL_FLOW_WINDOW_SECONDS,
        buckets: [
          { key: `ip:${rateLimitKeyPart(ip)}`, limit: 10 },
          { key: `email:${rateLimitKeyPart(email)}`, limit: 5 },
        ],
      });
  }
}

function authRateLimitMessage(action: "login" | "signup" | "resend-signup" | "forgot-password", retryAfterSeconds: number) {
  const wait = formatRetryAfter(retryAfterSeconds);
  if (action === "login") {
    return `Too many sign-in attempts were made from this device. Please wait ${wait} before trying again.`;
  }
  if (action === "signup") {
    return `Too many sign-up attempts were made recently. Please wait ${wait} before creating another account.`;
  }
  if (action === "resend-signup") {
    return `Too many confirmation emails were requested. Please wait ${wait} before asking for another one.`;
  }
  return `Too many password reset requests were made recently. Please wait ${wait} before trying again.`;
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };

  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const rateLimit = await checkAuthRateLimit("login", email);
  if (!rateLimit.allowed) {
    return { error: authRateLimitMessage("login", rateLimit.retryAfterSeconds), email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) };

  redirect(safeRedirectPath(formData.get("redirectTo")));
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };

  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const rateLimit = await checkAuthRateLimit("signup", email);
  if (!rateLimit.allowed) {
    return { error: authRateLimitMessage("signup", rateLimit.retryAfterSeconds), email };
  }

  const siteUrl = await resolveAuthSiteUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split("@")[0] },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return { error: authErrorMessage(error) };

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

  const email = normalizeEmail(formData.get("email"));
  if (!email) return { error: "Email is required.", nextStep: "confirm-signup" };

  const rateLimit = await checkAuthRateLimit("resend-signup", email);
  if (!rateLimit.allowed) {
    return {
      error: authRateLimitMessage("resend-signup", rateLimit.retryAfterSeconds),
      email,
      nextStep: "confirm-signup",
    };
  }

  const siteUrl = await resolveAuthSiteUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return {
      error: authErrorMessage(error),
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

  const email = normalizeEmail(formData.get("email"));
  if (!email) return { error: "Email is required." };

  const rateLimit = await checkAuthRateLimit("forgot-password", email);
  if (!rateLimit.allowed) {
    return {
      error: authRateLimitMessage("forgot-password", rateLimit.retryAfterSeconds),
      email,
    };
  }

  const genericResetMessage =
    "If this email belongs to a Stockli account, we just sent the next step. Please check your inbox, spam, junk, or promotions within 1 to 2 minutes.";
  const siteUrl = await resolveAuthSiteUrl();
  if (isSupabaseAdminConfigured) {
    const admin = createAdminClient();
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (!usersError) {
      const matchingUser = usersData.users.find(
        (user) => user.email?.toLowerCase() === email
      );

      if (matchingUser && !matchingUser.email_confirmed_at) {
        const supabase = await createClient();
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: `${siteUrl}/auth/callback`,
          },
        });

        if (error) {
          return { error: authErrorMessage(error), email };
        }

        return {
          email,
          message: genericResetMessage,
          nextStep: "reset-email-sent",
        };
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: authErrorMessage(error), email };

  return {
    email,
    message: genericResetMessage,
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
  if (error) return { error: authErrorMessage(error) };

  const email = user.email ?? null;
  const siteUrl = await resolveAuthSiteUrl();
  await supabase.auth.signOut();
  redirect(
    buildLoginUrl(siteUrl, "Password updated successfully. Sign in with your new password.", email)
  );
}

export async function signInWithGoogle(): Promise<AuthState> {
  if (isDemoMode) return { error: DEMO_MSG };
  const ip = await getRequestClientIp();
  const rateLimit = await enforceRateLimit({
    scope: "auth:oauth-google",
    windowSeconds: LOGIN_WINDOW_SECONDS,
    buckets: [{ key: `ip:${rateLimitKeyPart(ip)}`, limit: 12 }],
  });
  if (!rateLimit.allowed) {
    return {
      error: `Too many sign-in attempts were made from this device. Please wait ${formatRetryAfter(rateLimit.retryAfterSeconds)} before trying Google sign-in again.`,
    };
  }
  const siteUrl = await resolveAuthSiteUrl();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });
  if (error) return { error: authErrorMessage(error) };
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

export async function deleteAccount(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  if (isDemoMode) return { error: DEMO_MSG };
  if (!isSupabaseAdminConfigured) {
    return { error: "Secure account deletion is not configured yet. Please contact support." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please sign in again before deleting your account." };
  }

  const email = normalizeEmail(user.email);
  const confirmation = normalizeEmail(formData.get("confirmation"));
  if (!email || confirmation !== email) {
    return { error: "Type your full account email to confirm permanent deletion." };
  }

  const ip = await getRequestClientIp();
  const rateLimit = await enforceRateLimit({
    scope: "auth:delete-account",
    windowSeconds: DELETE_ACCOUNT_WINDOW_SECONDS,
    buckets: [
      { key: `ip:${rateLimitKeyPart(ip)}`, limit: 3 },
      { key: `user:${rateLimitKeyPart(user.id)}`, limit: 2 },
    ],
  });
  if (!rateLimit.allowed) {
    return {
      error: `Too many account deletion attempts were made. Please wait ${formatRetryAfter(rateLimit.retryAfterSeconds)} before trying again.`,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return {
      error: "We could not delete your account right now. Please try again in a minute.",
    };
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // The auth record is already removed, so sign-out becomes best-effort.
  }

  const siteUrl = await resolveAuthSiteUrl();
  redirect(
    buildLoginUrl(siteUrl, "Your account and personal data were deleted successfully.", null, {
      accountDeleted: true,
    })
  );
}
