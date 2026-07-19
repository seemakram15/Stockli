"use client";

import * as React from "react";
import { Download, Share2, MoreVertical, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type Platform = "ios-safari" | "ios-other" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) &&
    !(window as unknown as Record<string, unknown>).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isAndroid = /android/i.test(ua);
  if (isIOS) return isSafari ? "ios-safari" : "ios-other";
  if (isAndroid) return "android";
  return "desktop";
}

function isStandalone() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export function InstallAppButton({
  className,
  variant = "outline",
  size = "default",
  label = "Install app",
}: {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
}) {
  const [promptEvent, setPromptEvent] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);
  const [platform, setPlatform] = React.useState<Platform>("desktop");

  React.useEffect(() => {
    setInstalled(isStandalone());
    setPlatform(detectPlatform());

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
      setOpen(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (installed) return;

    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setPromptEvent(null);
      return;
    }

    setOpen(true);
  }

  if (installed) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("gap-1.5", className)}
        onClick={install}
      >
        <Download className="size-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Install Stockli</DialogTitle>
            <DialogDescription>
              {platform === "ios-other"
                ? "Open this page in Safari to install the app."
                : "Add Stockli to your home screen — it opens like a native app."}
            </DialogDescription>
          </DialogHeader>

          {platform === "ios-safari" && <IOSSafariSteps />}
          {platform === "ios-other" && <IOSOtherSteps />}
          {platform === "android" && <AndroidSteps />}
          {platform === "desktop" && <DesktopSteps />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({
  num,
  icon,
  text,
}: {
  num: number;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {num}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 pt-0.5">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <p className="text-sm text-foreground">{text}</p>
      </div>
    </div>
  );
}

function IOSSafariSteps() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center rounded-xl border border-border bg-muted/30 p-4">
        <Share2 className="mb-2 size-8 text-blue-500" />
        <p className="text-xs text-muted-foreground">
          Tap the Share icon in Safari&apos;s bottom bar
        </p>
      </div>
      <div className="space-y-3">
        <Step
          num={1}
          icon={<Share2 className="size-4" />}
          text="Tap the Share button at the bottom of Safari"
        />
        <Step
          num={2}
          icon={<ArrowDown className="size-4" />}
          text='Scroll down and tap "Add to Home Screen"'
        />
        <Step
          num={3}
          icon={<Download className="size-4" />}
          text='Tap "Add" in the top right — done!'
        />
      </div>
    </div>
  );
}

function IOSOtherSteps() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center rounded-xl border border-border bg-muted/30 p-4">
        <Share2 className="mb-2 size-8 text-blue-500" />
        <p className="text-xs text-muted-foreground">
          Use the Share icon or browser menu
        </p>
      </div>
      <div className="space-y-3">
        <Step
          num={1}
          icon={<Share2 className="size-4" />}
          text="Tap the Share button (bottom of screen) or the browser menu"
        />
        <Step
          num={2}
          icon={<ArrowDown className="size-4" />}
          text='"Add to Home Screen"'
        />
        <Step
          num={3}
          icon={<Download className="size-4" />}
          text='Tap "Add" — Stockli appears on your home screen'
        />
      </div>
    </div>
  );
}

function AndroidSteps() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center rounded-xl border border-border bg-muted/30 p-4">
        <MoreVertical className="mb-2 size-8 text-primary" />
        <p className="text-xs text-muted-foreground">
          Tap the three-dot menu in Chrome
        </p>
      </div>
      <div className="space-y-3">
        <Step
          num={1}
          icon={<MoreVertical className="size-4" />}
          text="Tap the ⋮ menu in the top-right corner of Chrome"
        />
        <Step
          num={2}
          icon={<Download className="size-4" />}
          text='"Add to Home Screen" or "Install app"'
        />
        <Step
          num={3}
          icon={<Download className="size-4" />}
          text='Tap "Add" — the Stockli icon appears on your home screen'
        />
      </div>
    </div>
  );
}

function DesktopSteps() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center rounded-xl border border-border bg-muted/30 p-4">
        <Download className="mb-2 size-8 text-primary" />
        <p className="text-xs text-muted-foreground">
          Look for the install icon in your address bar
        </p>
      </div>
      <div className="space-y-3">
        <Step
          num={1}
          icon={<Download className="size-4" />}
          text="Look for the install icon (⊕) at the right end of the address bar"
        />
        <Step
          num={2}
          icon={<MoreVertical className="size-4" />}
          text='Or open the browser menu and choose "Install Stockli" / "Install app"'
        />
        <Step
          num={3}
          icon={<Download className="size-4" />}
          text='Click "Install" — Stockli opens as a desktop app'
        />
      </div>
    </div>
  );
}
