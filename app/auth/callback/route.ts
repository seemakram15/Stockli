import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { safeRedirectPath } from "@/lib/security/validation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth / email-confirmation callback. Supabase redirects here with a `code`
 * which we exchange for a session cookie, then forward to the app.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");
  const tokenHash = searchParams.get("token_hash");
  const type = normalizeOtpType(searchParams.get("type"));
  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectAfterSuccess(type, next, data.user?.email ?? data.session?.user?.email);
    }
    return redirectToLoginWithError("We could not complete that sign-in link. Please try again.");
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      return redirectAfterSuccess(type, next, data.user?.email);
    }
    return redirectToLoginWithError(callbackErrorMessage(type));
  }

  return redirectToLoginWithError("That auth link is invalid or expired. Please request a fresh one.");
}

function redirectToLoginWithError(message: string) {
  const loginUrl = new URL("/login", config.siteUrl);
  loginUrl.searchParams.set("authError", message);
  return NextResponse.redirect(loginUrl);
}

function redirectToLoginWithMessage(message: string, email?: string | null) {
  const loginUrl = new URL("/login", config.siteUrl);
  loginUrl.searchParams.set("authMessage", message);
  if (email) loginUrl.searchParams.set("authEmail", email);
  return NextResponse.redirect(loginUrl);
}

function redirectAfterSuccess(type: EmailOtpType | null, next: string, email?: string | null) {
  if (type === "signup") {
    return redirectToLoginWithMessage(
      "Email verified successfully. Sign in to continue to your Stockli dashboard.",
      email
    );
  }
  return NextResponse.redirect(new URL(next, config.siteUrl));
}

function normalizeOtpType(value: string | null): EmailOtpType | null {
  if (
    value === "signup" ||
    value === "recovery" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "email_change" ||
    value === "email"
  ) {
    return value;
  }
  return null;
}

function callbackErrorMessage(type: EmailOtpType) {
  if (type === "recovery") {
    return "That password reset link is invalid or expired. Request a fresh reset email.";
  }
  return "That confirmation link is invalid or expired. Request a fresh confirmation email and try again.";
}
