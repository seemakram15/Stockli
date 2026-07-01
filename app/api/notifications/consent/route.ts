import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import { getVapidPublicKey } from "@/lib/services/push-notifications";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationConsentStatus = "unknown" | "granted" | "denied";

export async function GET() {
  const base = {
    vapidPublicKey: getVapidPublicKey(),
    cookieConsentAt: null as string | null,
    notificationConsentStatus: "unknown" as NotificationConsentStatus,
  };

  if (isDemoMode) {
    return NextResponse.json(base, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(base, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  }

  const { data } = await supabase
    .from("profiles")
    .select("cookie_consent_at,notification_consent_status")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json(
    {
      ...base,
      cookieConsentAt: (data?.cookie_consent_at as string | null) ?? null,
      notificationConsentStatus:
        ((data?.notification_consent_status as NotificationConsentStatus | null) ?? "unknown"),
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

export async function POST(request: Request) {
  if (isDemoMode) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await safeJson(request);
  const notificationStatus = normalizeNotificationStatus(body.notificationStatus);
  const update: Record<string, string> = {};
  const now = new Date().toISOString();

  if (body.cookieConsent === true) {
    update.cookie_consent_at = now;
    update.cookie_consent_version = "2026-06-29";
  }
  if (notificationStatus) {
    update.notification_consent_at = now;
    update.notification_consent_status = notificationStatus;
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

async function safeJson(request: Request): Promise<{
  cookieConsent?: boolean;
  notificationStatus?: string;
}> {
  try {
    return (await request.json()) as {
      cookieConsent?: boolean;
      notificationStatus?: string;
    };
  } catch {
    return {};
  }
}

function normalizeNotificationStatus(value: string | undefined): NotificationConsentStatus | null {
  if (value === "granted" || value === "denied") return value;
  if (value === "default" || value === "unknown") return "unknown";
  return null;
}
