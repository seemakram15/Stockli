"use client";

import * as React from "react";
import { BellRing, Cookie, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COOKIE_CONSENT_KEY = "stockli-cookie-consent-v1";
const NOTIFICATION_DISMISS_KEY = "stockli-notification-consent-dismissed-v1";

interface ConsentState {
  vapidPublicKey: string | null;
  cookieConsentAt: string | null;
  notificationConsentStatus: "unknown" | "granted" | "denied";
}

export function ConsentManager() {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [vapidPublicKey, setVapidPublicKey] = React.useState<string | null>(null);
  const [pushSupported, setPushSupported] = React.useState(false);

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
        const cookieAccepted =
          window.localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted" ||
          Boolean(state.cookieConsentAt);
        const dismissed = window.localStorage.getItem(NOTIFICATION_DISMISS_KEY) === "1";
        const permission = supported ? Notification.permission : "denied";
        setVisible(!cookieAccepted || (Boolean(state.vapidPublicKey) && permission === "default" && !dismissed));
      })
      .catch(() => {
        const cookieAccepted = window.localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
        setVisible(!cookieAccepted);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted || !visible) return null;

  const canEnablePush = pushSupported && Boolean(vapidPublicKey);

  async function acceptCookies() {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    await postConsent({ cookieConsent: true });
  }

  async function dismiss() {
    window.localStorage.setItem(NOTIFICATION_DISMISS_KEY, "1");
    await acceptCookies();
    setVisible(false);
  }

  async function enableNotifications() {
    setBusy(true);
    try {
      await acceptCookies();
      if (!canEnablePush || !vapidPublicKey) {
        toast.info("Browser notifications will be available after push keys are configured.");
        setVisible(false);
        return;
      }

      const permission = await Notification.requestPermission();
      await postConsent({
        notificationStatus: permission === "granted" ? "granted" : permission === "denied" ? "denied" : "unknown",
      });

      if (permission !== "granted") {
        window.localStorage.setItem(NOTIFICATION_DISMISS_KEY, "1");
        toast.info("Notifications are off. You can enable them later from browser settings.");
        setVisible(false);
        return;
      }

      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
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

      toast.success("Market notifications enabled.");
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
          <p className="text-sm font-semibold">Cookies and notifications</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Stockli uses device cache and cookies to keep screens fast. You can also enable market,
            alert and portfolio notifications for this browser or installed app.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={dismiss} disabled={busy}>
          <Cookie className="size-4" />
          Accept cookies
        </Button>
        <Button type="button" onClick={enableNotifications} disabled={busy}>
          <BellRing className="size-4" />
          Enable alerts
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
