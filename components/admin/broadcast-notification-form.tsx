"use client";

import * as React from "react";
import { useActionState } from "react";
import { BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendBroadcastNotification,
  type AdminActionState,
} from "@/lib/actions/admin";

export function BroadcastNotificationForm({ demo }: { demo?: boolean }) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    sendBroadcastNotification,
    {}
  );

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Notification sent");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="broadcast-type">Type</Label>
          <select
            id="broadcast-type"
            name="type"
            defaultValue="SYSTEM"
            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="SYSTEM">System</option>
            <option value="MARKET">Market</option>
            <option value="PORTFOLIO">Portfolio</option>
            <option value="ALERT">Alert</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="broadcast-title">Title</Label>
          <Input
            id="broadcast-title"
            name="title"
            placeholder="Market update, maintenance notice, feature news..."
            maxLength={120}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="broadcast-body">Message</Label>
        <textarea
          id="broadcast-body"
          name="body"
          rows={3}
          maxLength={500}
          placeholder="Write a clear short message users will see in the app and push notification."
          className="w-full resize-none rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="broadcast-href">Open link</Label>
          <Input
            id="broadcast-href"
            name="href"
            placeholder="/dashboard"
            defaultValue="/dashboard"
            maxLength={200}
          />
          <p className="text-xs text-muted-foreground">
            Use an internal path. Users who tap the notification will open this screen.
          </p>
        </div>
        <Button type="submit" disabled={pending || demo} className="h-9">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send to all
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/35 p-3 text-xs text-muted-foreground">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          This sends an in-app notification to all users. Desktop and installed-app push
          delivery is sent only to users who allowed notifications on their device.
        </p>
      </div>
    </form>
  );
}
