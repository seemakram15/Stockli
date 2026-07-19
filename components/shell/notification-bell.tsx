"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, BellRing, Activity, Info, CircleAlert, WalletCards, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { markNotificationsSeen } from "@/lib/actions/notifications";
import type { AppNotification, NotificationType } from "@/lib/types";

interface Feed {
  items: AppNotification[];
  unread: number;
}

const ICONS: Record<NotificationType, typeof Bell> = {
  ALERT: CircleAlert,
  MARKET: Activity,
  SYSTEM: Info,
  PORTFOLIO: WalletCards,
  WATCHLIST: Star,
};

export function NotificationBell({ userId: _userId }: { userId: string }) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [countLoaded, setCountLoaded] = React.useState(false);

  // Fetch just the unread count on mount — one cheap query, no notification items.
  // The full list only loads when the popover is opened.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/unread")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data && typeof data.unread === "number") {
          setUnread(data.unread);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCountLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // Listen for push-received messages from the service worker to bump the badge
  // in real time when a notification arrives while the app is open.
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "push-received") {
        setUnread((u) => u + 1);
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  async function fetchFeed() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data: Feed = await res.json();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      // silently ignore
    }
  }

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      await fetchFeed();
      setUnread(0);
      try {
        await markNotificationsSeen();
      } catch {
        // will resync on next open
      }
    }
  }

  void _userId;

  const showBadge = countLoaded && unread > 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          {showBadge ? <BellRing className="size-4" /> : <Bell className="size-4" />}
          {showBadge && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-semibold text-loss-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="z-[220] w-[min(92vw,22rem)] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">{items.length} recent</span>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto scrollbar-thin">
          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const Icon = ICONS[n.type] ?? Info;
                const body = (
                  <div className="flex gap-3 px-4 py-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        n.type === "ALERT"
                          ? "bg-chart-3/15 text-chart-3"
                          : n.type === "MARKET"
                            ? "bg-primary/10 text-primary"
                            : n.type === "WATCHLIST"
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id} className="transition-colors hover:bg-accent/40">
                    {n.href || n.symbol ? (
                      <Link href={n.href ?? `/stock/${n.symbol}`} onClick={() => setOpen(false)}>
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border px-4 py-2 text-center">
          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Manage alerts
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
