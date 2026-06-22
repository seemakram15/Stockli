"use client";

import * as React from "react";
import { Download, MonitorSmartphone, Share } from "lucide-react";
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
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);

  React.useEffect(() => {
    setInstalled(isStandalone());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
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
    if (!promptEvent) {
      setOpen(true);
      return;
    }

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Stockli</DialogTitle>
            <DialogDescription>
              Add Stockli to your home screen and open it like a normal app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 font-medium">
                <Share className="size-4 text-primary" />
                iPhone or iPad
              </div>
              <p className="mt-1 text-muted-foreground">
                In Safari, tap Share, then choose Add to Home Screen.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-2 font-medium">
                <MonitorSmartphone className="size-4 text-primary" />
                Android or desktop
              </div>
              <p className="mt-1 text-muted-foreground">
                Open the browser menu and choose Install app or Add to Home screen.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function isStandalone() {
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}
