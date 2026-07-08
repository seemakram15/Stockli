"use client";

import * as React from "react";
import { useActionState } from "react";
import { BellRing, ChevronRight, ExternalLink, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconChip } from "@/components/ui/accent";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendBroadcastNotification, type AdminActionState } from "@/lib/actions/admin";

const BROADCAST_TYPES = [
  {
    value: "SYSTEM",
    label: "System",
    title: "Platform update",
    body: "Stockli will be under maintenance tonight from 11:30 PM to 12:00 AM.",
    href: "/dashboard",
    accent: "from-sky-500/15 to-cyan-500/10",
  },
  {
    value: "MARKET",
    label: "Market",
    title: "Market update",
    body: "Oil prices are moving sharply today, so energy names may stay active through the session.",
    href: "/market",
    accent: "from-emerald-500/15 to-teal-500/10",
  },
  {
    value: "PORTFOLIO",
    label: "Portfolio",
    title: "Portfolio update",
    body: "Your portfolio moved higher today as banking and fertilizer names added to gains.",
    href: "/portfolios",
    accent: "from-violet-500/15 to-fuchsia-500/10",
  },
  {
    value: "ALERT",
    label: "Alert",
    title: "Price alert",
    body: "One of your tracked stocks has crossed the level you were watching.",
    href: "/alerts",
    accent: "from-amber-500/15 to-orange-500/10",
  },
] as const;

type BroadcastType = (typeof BROADCAST_TYPES)[number]["value"];

function getTypeMeta(type: BroadcastType) {
  return BROADCAST_TYPES.find((item) => item.value === type) ?? BROADCAST_TYPES[0];
}

export function BroadcastNotificationForm({ demo }: { demo?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<BroadcastType>("SYSTEM");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [href, setHref] = React.useState("/dashboard");
  const formRef = React.useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    sendBroadcastNotification,
    {}
  );

  const selectedMeta = getTypeMeta(selectedType);

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Notification sent");
      setOpen(false);
      setSelectedType("SYSTEM");
      setTitle("");
      setBody("");
      setHref("/dashboard");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  function applySuggestion(type: BroadcastType) {
    const meta = getTypeMeta(type);
    setSelectedType(type);
    setTitle(meta.title);
    setBody(meta.body);
    setHref(meta.href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="h-11 gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-fuchsia-400 hover:shadow-violet-500/35"
          disabled={demo}
        >
          <BellRing className="size-4" />
          Send notifications
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl overflow-hidden border-0 bg-white p-0 sm:max-w-4xl" showCloseButton>
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.16),_transparent_28%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(240,253,250,0.92))]">
          <DialogHeader className="border-b border-border/70 px-6 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <IconChip accent="violet" variant="gradient" size="lg">
                <BellRing />
              </IconChip>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-foreground sm:text-2xl">
                  Send a broadcast notification
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl text-sm leading-6">
                  Send a clear update to every user through in-app notifications, with push delivery
                  going to devices that already allowed alerts.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-border/70 px-6 py-6 lg:border-b-0 lg:border-r lg:px-8">
              <form ref={formRef} action={action} className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-sm font-semibold text-foreground">Notification type</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-violet-700 hover:text-violet-800"
                      onClick={() => applySuggestion(selectedType)}
                    >
                      <Sparkles className="size-3.5" />
                      Fill sample
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {BROADCAST_TYPES.map((type) => {
                      const active = selectedType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setSelectedType(type.value)}
                          className={[
                            "rounded-2xl border px-4 py-3 text-left transition-all",
                            active
                              ? "border-violet-400 bg-violet-50 shadow-sm ring-2 ring-violet-200/70"
                              : "border-border bg-white hover:border-violet-200 hover:bg-violet-50/40",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{type.label}</span>
                            <span
                              className={[
                                "size-2.5 rounded-full",
                                active ? "bg-violet-500" : "bg-muted-foreground/30",
                              ].join(" ")}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{type.title}</p>
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" name="type" value={selectedType} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcast-title" className="text-sm font-semibold">
                    Title
                  </Label>
                  <Input
                    id="broadcast-title"
                    name="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Write a short, human-friendly title"
                    minLength={2}
                    maxLength={120}
                    required
                    className="h-12 rounded-xl bg-white"
                  />
                  <p className="text-xs text-muted-foreground">
                    Keep the title short. Two words like “Hi team” or “Market update” are enough.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcast-body" className="text-sm font-semibold">
                    Message
                  </Label>
                  <textarea
                    id="broadcast-body"
                    name="body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={5}
                    maxLength={500}
                    placeholder="Explain the update in simple language users will understand immediately."
                    className="w-full resize-none rounded-2xl border border-input bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>Keep it short, clear, and useful.</span>
                    <span>{body.trim().length}/500</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="broadcast-href" className="text-sm font-semibold">
                    Open screen
                  </Label>
                  <div className="relative">
                    <Input
                      id="broadcast-href"
                      name="href"
                      value={href}
                      onChange={(event) => setHref(event.target.value)}
                      placeholder="/dashboard"
                      maxLength={200}
                      className="h-12 rounded-xl bg-white pr-10"
                    />
                    <ExternalLink className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use an internal path. When users tap the notification, Stockli opens this page.
                  </p>
                </div>

                {state.error ? (
                  <div className="rounded-2xl border border-loss/20 bg-loss/5 px-4 py-3 text-sm text-loss">
                    {state.error}
                  </div>
                ) : null}

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
                  <Button type="button" variant="outline" className="h-11" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={pending || demo}
                    className="h-11 gap-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-fuchsia-400 hover:shadow-violet-500/35"
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Send to all users
                  </Button>
                </div>
              </form>
            </div>

            <div className="px-6 py-6 lg:px-8">
              <div className="space-y-5">
                <div className={`rounded-3xl border border-border/70 bg-gradient-to-br ${selectedMeta.accent} p-5 shadow-sm`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                        Live preview
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {title.trim() || "Your notification title will appear here"}
                      </p>
                    </div>
                    <IconChip accent="violet" variant="gradient">
                      <BellRing />
                    </IconChip>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {body.trim() ||
                      "Write the message users should see in the app and on push notifications."}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                    Opens
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                    {href.trim() || "/dashboard"}
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                    Delivery
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-muted/35 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">In-app notification</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Every signed-in user sees the message inside Stockli.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted/35 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">Push delivery</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Desktop and installed-app push goes only to users who already allowed notifications.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                    Best practice
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <li>Use a short title users can understand in one glance.</li>
                    <li>Tell users what happened, why it matters, and where the tap should take them.</li>
                    <li>Avoid long paragraphs so the same message also looks clean as a push notification.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
