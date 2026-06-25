"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { Bell, BellRing, Activity, Info, CircleAlert, WalletCards } from "lucide-react";
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

const fetcher = (url: string): Promise<Feed> => fetch(url).then((r) => r.json());

const ICONS: Record<NotificationType, typeof Bell> = {
  ALERT: CircleAlert,
  MARKET: Activity,
  SYSTEM: Info,
  PORTFOLIO: WalletCards,
};

export function NotificationBell() {
  const { data, mutate } = useSWR<Feed>("/api/notifications", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });
  const [open, setOpen] = React.useState(false);
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && unread > 0) {
      // Optimistically clear the badge, then persist.
      mutate({ items, unread: 0 }, { revalidate: false });
      try {
        await markNotificationsSeen();
      } catch {
        /* will resync on next poll */
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          {unread > 0 ? <BellRing className="size-4" /> : <Bell className="size-4" />}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-semibold text-loss-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
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
