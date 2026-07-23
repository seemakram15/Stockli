import "server-only";

import webPush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

export interface PushPayload {
  title: string;
  body?: string | null;
  url?: string | null;
  tag?: string;
  type?: string;
  symbol?: string | null;
}

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function getVapidPublicKey(): string | null {
  return isPushConfigured() ? config.notifications.vapidPublicKey : null;
}

export function isPushConfigured(): boolean {
  return Boolean(
    config.notifications.vapidPublicKey &&
      config.notifications.vapidPrivateKey &&
      config.notifications.vapidSubject
  );
}

function configureWebPush() {
  if (!isPushConfigured()) return false;
  try {
    webPush.setVapidDetails(
      config.notifications.vapidSubject,
      config.notifications.vapidPublicKey,
      config.notifications.vapidPrivateKey
    );
    return true;
  } catch (error) {
    console.warn("[push] invalid VAPID configuration:", error);
    return false;
  }
}

async function hasGrantedPushConsent(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("notification_consent_status")
    .eq("id", userId)
    .maybeSingle();
  return data?.notification_consent_status === "granted";
}

export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload
) {
  if (!configureWebPush()) return { sent: 0, skipped: "missing-vapid-config" };

  if (!(await hasGrantedPushConsent(admin, userId))) {
    return { sent: 0, skipped: "consent-not-granted" };
  }

  const { data: rows } = await admin
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .eq("user_id", userId);

  return sendPushRows(admin, (rows as PushSubscriptionRow[] | null) ?? [], payload);
}

export async function sendPushToAll(admin: SupabaseClient, payload: PushPayload) {
  if (!configureWebPush()) return { sent: 0, skipped: "missing-vapid-config" };

  const [{ data: grantedProfiles }, { data: rows }] = await Promise.all([
    admin.from("profiles").select("id").eq("notification_consent_status", "granted"),
    admin.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth"),
  ]);

  const grantedIds = new Set(
    ((grantedProfiles as { id: string }[] | null) ?? []).map((profile) => profile.id)
  );
  const eligible = ((rows as PushSubscriptionRow[] | null) ?? []).filter((row) =>
    grantedIds.has(row.user_id)
  );

  return sendPushRows(admin, eligible, payload);
}

async function sendPushRows(
  admin: SupabaseClient,
  rows: PushSubscriptionRow[],
  payload: PushPayload
) {
  if (rows.length === 0) return { sent: 0 };

  let sent = 0;
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body ?? "",
            url: payload.url ?? "/dashboard",
            tag: payload.tag,
            type: payload.type,
            symbol: payload.symbol,
          }),
          {
            // Deliver promptly on phones/desktops, and drop instead of piling
            // up if the device stays offline past an hour — stale market pings
            // arriving in a burst the next morning are worse than none.
            TTL: 60 * 60,
            urgency: payload.type === "ALERT" || payload.type === "NEWS" ? "high" : "normal",
          }
        );
        sent += 1;
        await admin
          .from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), last_error: null })
          .eq("id", row.id);
      } catch (error) {
        const statusCode =
          typeof error === "object" && error && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : null;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        await admin
          .from("push_subscriptions")
          .update({ last_error: message.slice(0, 500) })
          .eq("id", row.id);
      }
    })
  );

  return { sent };
}
