"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

const STORAGE_KEY = "stockli:guest-popup:last";
const COOLDOWN_MS = 4 * 60_000;
const SHOW_CHANCE = 0.3;

/** Occasional, dismissible nudge for guests to sign up — never blocks browsing. */
export function GuestSignupNudge() {
  const pathname = usePathname();
  const router = useRouter();
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const last = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    const now = Date.now();
    if (now - last < COOLDOWN_MS) return;
    if (Math.random() >= SHOW_CHANCE) return;

    window.localStorage.setItem(STORAGE_KEY, String(now));
    toast("Enjoying Stockli?", {
      description: "Create a free account to track your own portfolio and get alerts.",
      duration: 8000,
      action: {
        label: "Sign up",
        onClick: () => router.push("/signup"),
      },
      cancel: {
        label: "Log in",
        onClick: () => router.push("/login"),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
