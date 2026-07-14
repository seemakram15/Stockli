"use client";

import * as React from "react";
import { toast } from "sonner";
import { updateAppSetting } from "@/lib/actions/app-settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PageKind } from "@/lib/access/page-registry";

interface PageRow {
  key: string;
  label: string;
  href: string;
  kind: PageKind;
  enabled: boolean;
  settingKey: string;
}

export function CustomisationEditor({
  guestBrowsingEnabled,
  guestBrowsingKey,
  guestPopupEnabled,
  guestPopupKey,
  pages,
}: {
  guestBrowsingEnabled: boolean;
  guestBrowsingKey: string;
  guestPopupEnabled: boolean;
  guestPopupKey: string;
  pages: PageRow[];
}) {
  const [masterEnabled, setMasterEnabled] = React.useState(guestBrowsingEnabled);
  const [popupEnabled, setPopupEnabled] = React.useState(guestPopupEnabled);
  const [pageStates, setPageStates] = React.useState<Record<string, boolean>>(
    Object.fromEntries(pages.map((p) => [p.key, p.enabled]))
  );
  const [pending, setPending] = React.useState<string | null>(null);

  async function handleToggle(
    settingKey: string,
    next: boolean,
    apply: () => void,
    revert: () => void
  ) {
    setPending(settingKey);
    apply();
    const result = await updateAppSetting(settingKey, next);
    setPending(null);
    if (result.error) {
      revert();
      toast.error("Could not save — please try again.");
    } else {
      toast.success("Saved.");
    }
  }

  const dummyPages = pages.filter((p) => p.kind === "dummy");
  const openPages = pages.filter((p) => p.kind === "open");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Master switches</CardTitle>
          <CardDescription>Control the whole guest-browsing feature at once.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleRow
            label="Enable public browsing"
            description="Let unauthenticated visitors navigate the site with sample data on personal pages."
            checked={masterEnabled}
            disabled={pending === guestBrowsingKey}
            onCheckedChange={(next) =>
              handleToggle(
                guestBrowsingKey,
                next,
                () => setMasterEnabled(next),
                () => setMasterEnabled(!next)
              )
            }
          />
          <ToggleRow
            label="Enable signup popups"
            description="Occasionally nudge guests to sign up while they browse."
            checked={popupEnabled}
            disabled={pending === guestPopupKey}
            onCheckedChange={(next) =>
              handleToggle(
                guestPopupKey,
                next,
                () => setPopupEnabled(next),
                () => setPopupEnabled(!next)
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal pages (sample data for guests)</CardTitle>
          <CardDescription>
            Dashboard, Portfolio, Watchlist, Alerts. Off = guests are redirected to login for that
            page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {dummyPages.map((page) => (
            <ToggleRow
              key={page.key}
              label={page.label}
              description={page.href}
              checked={pageStates[page.key]}
              disabled={pending === page.settingKey}
              onCheckedChange={(next) =>
                handleToggle(
                  page.settingKey,
                  next,
                  () => setPageStates((s) => ({ ...s, [page.key]: next })),
                  () => setPageStates((s) => ({ ...s, [page.key]: !next }))
                )
              }
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Public pages (real data for everyone)</CardTitle>
          <CardDescription>
            Market, Tools, Explore, stock detail, search. Off = guests are redirected to login for
            that page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {openPages.map((page) => (
            <ToggleRow
              key={page.key}
              label={page.label}
              description={page.href}
              checked={pageStates[page.key]}
              disabled={pending === page.settingKey}
              onCheckedChange={(next) =>
                handleToggle(
                  page.settingKey,
                  next,
                  () => setPageStates((s) => ({ ...s, [page.key]: next })),
                  () => setPageStates((s) => ({ ...s, [page.key]: !next }))
                )
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg px-2 py-2.5",
        !checked && "opacity-70"
      )}
    >
      <div className="min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
