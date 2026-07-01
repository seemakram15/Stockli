"use client";

import * as React from "react";
import { BellRing, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEVICE_CONSENT_KEY = "stockli-device-consent-v2";
const DEVICE_CONSENT_DISMISS_KEY = "stockli-device-consent-dismissed-v2";

interface ConsentState {
  vapidPublicKey: string | null;
  notificationConsentStatus: "unknown" | "granted" | "denied";
}

function scopedConsentKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

export function ConsentManager({ userId }: { userId: string }) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [vapidPublicKey, setVapidPublicKey] = React.useState<string | null>(null);
  const [pushSupported, setPushSupported] = React.useState(false);

  const syncPushSubscription = React.useCallback(
    async ({
      vapidPublicKey,
      syncConsent = false,
      showSuccessToast = false,
    }: {
      vapidPublicKey: string;
      syncConsent?: boolean;
      showSuccessToast?: boolean;
    }) => {
      if (
        !pushSupported ||
        !vapidPublicKey ||
        typeof window === "undefined" ||
        Notification.permission !== "granted"
      ) {
        return false;
      }

      const registration = await ensureServiceWorkerRegistration();
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const response = await fetch("/api/notifications/push-subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) throw new Error("Could not save notification subscription.");

      if (syncConsent) {
        await postConsent({ notificationStatus: "granted" });
      }

      if (showSuccessToast) {
        toast.success("Notifications are enabled. Stockli can now alert you even when the app is closed.");
      }
      return true;
    },
    [pushSupported]
  );

  React.useEffect(() => {
    setMounted(true);
    const supported =
      typeof window !== "undefined" &&
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setPushSupported(supported);

    let cancelled = false;
    fetch("/api/notifications/consent", { headers: { accept: "application/json" } })
      .then((response) => response.json() as Promise<ConsentState>)
      .then((state) => {
        if (cancelled) return;
        setVapidPublicKey(state.vapidPublicKey);
        const consentKey = scopedConsentKey(DEVICE_CONSENT_KEY, userId);
        const dismissKey = scopedConsentKey(DEVICE_CONSENT_DISMISS_KEY, userId);
        const deviceConsentAccepted = window.localStorage.getItem(consentKey) === "accepted";
        const dismissed = window.localStorage.getItem(dismissKey) === "1";
        const permission = supported ? Notification.permission : "denied";
        setVisible(!deviceConsentAccepted && !dismissed);

        if (state.vapidPublicKey && permission === "granted") {
          void syncPushSubscription({
            vapidPublicKey: state.vapidPublicKey,
            syncConsent: state.notificationConsentStatus !== "granted",
          }).catch(() => undefined);
        } else if (supported && permission === "denied" && state.notificationConsentStatus !== "denied") {
          void postConsent({ notificationStatus: "denied" });
        }
      })
      .catch(() => {
        const consentKey = scopedConsentKey(DEVICE_CONSENT_KEY, userId);
        const dismissKey = scopedConsentKey(DEVICE_CONSENT_DISMISS_KEY, userId);
        const deviceConsentAccepted = window.localStorage.getItem(consentKey) === "accepted";
        const dismissed = window.localStorage.getItem(dismissKey) === "1";
        setVisible(!deviceConsentAccepted && !dismissed);
      });

    return () => {
      cancelled = true;
    };
  }, [syncPushSubscription, userId]);

  if (!mounted || !visible) return null;

  const canEnablePush = pushSupported && Boolean(vapidPublicKey);

  async function acceptDeviceConsent() {
    window.localStorage.setItem(scopedConsentKey(DEVICE_CONSENT_KEY, userId), "accepted");
    window.localStorage.removeItem(scopedConsentKey(DEVICE_CONSENT_DISMISS_KEY, userId));
    await postConsent({ cookieConsent: true });
  }

  async function dismiss() {
    window.localStorage.setItem(scopedConsentKey(DEVICE_CONSENT_DISMISS_KEY, userId), "1");
    setVisible(false);
  }

  async function acceptConsent() {
    setBusy(true);
    try {
      await acceptDeviceConsent();
      if (!canEnablePush || !vapidPublicKey) {
        toast.info("Cookies are saved for this device. Notifications will be available after push is configured.");
        setVisible(false);
        return;
      }

      const permission = await Notification.requestPermission();
      await postConsent({
        notificationStatus: permission === "granted" ? "granted" : permission === "denied" ? "denied" : "unknown",
      });

      if (permission !== "granted") {
        toast.info("Cookies are saved. You can enable notifications later from this browser's settings.");
        setVisible(false);
        return;
      }

      await syncPushSubscription({
        vapidPublicKey,
        showSuccessToast: true,
      });
      setVisible(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 z-[230] w-[min(calc(100vw-1.5rem),25rem)] rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl",
        "supports-[backdrop-filter]:bg-popover/95 supports-[backdrop-filter]:backdrop-blur"
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Close consent prompt"
      >
        <X className="size-4" />
      </button>

      <div className="flex gap-3 pr-8">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Allow cookies and alerts on this device</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Stockli uses cookies and device storage to keep pages fast. When you continue, we will
            also ask this browser or app for permission to send market, alert, and portfolio updates.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Button type="button" onClick={acceptConsent} disabled={busy} className="w-full">
          <BellRing className="size-4" />
          Accept and enable alerts
        </Button>
      </div>
    </div>
  );
}

async function postConsent(body: { cookieConsent?: boolean; notificationStatus?: string }) {
  await fetch("/api/notifications/consent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function ensureServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration();
  if (!existing) {
    await navigator.serviceWorker.register("/sw.js");
  }
  return navigator.serviceWorker.ready;
}
