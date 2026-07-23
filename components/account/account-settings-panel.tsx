"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  updateAccountAvatar,
  updateAccountEmail,
  updateAccountPassword,
  updateAccountProfile,
  updateTaxSettings,
  type AccountActionState,
} from "@/lib/actions/account";
import type { TaxSettings } from "@/lib/types";

function initials(name: string | null, email: string | null) {
  const base = name || email || "U";
  const parts = base.split(/[ @.]/).filter(Boolean);
  return (parts[0]?.[0] ?? "U").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AccountSettingsPanel({
  displayName,
  email,
  avatarUrl,
  taxSettings,
  demo = false,
}: {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  taxSettings: TaxSettings;
  demo?: boolean;
}) {
  const router = useRouter();

  const [avatarState, avatarAction, avatarPending] = useActionState<AccountActionState, FormData>(
    updateAccountAvatar,
    {}
  );
  const [taxState, taxAction, taxPending] = useActionState<AccountActionState, FormData>(
    updateTaxSettings,
    {}
  );

  const [nameValue, setNameValue] = React.useState(displayName ?? "");
  const [emailValue, setEmailValue] = React.useState(email ?? "");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [accountPending, setAccountPending] = React.useState(false);
  const [accountError, setAccountError] = React.useState<string | null>(null);

  const [selectedAvatarName, setSelectedAvatarName] = React.useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = React.useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(avatarUrl);
  const avatarFormRef = React.useRef<HTMLFormElement>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const [taxFiler, setTaxFiler] = React.useState(taxSettings.taxFiler);
  const [brokerFeePct, setBrokerFeePct] = React.useState(String(taxSettings.brokerFeePct));
  const [zakatEnabled, setZakatEnabled] = React.useState(taxSettings.zakatOnDividends);
  const [cgtOverride, setCgtOverride] = React.useState(
    taxSettings.cgtRateOverride != null ? String(taxSettings.cgtRateOverride) : ""
  );

  React.useEffect(() => setNameValue(displayName ?? ""), [displayName]);
  React.useEffect(() => setEmailValue(email ?? ""), [email]);
  React.useEffect(() => {
    if (!selectedAvatarFile) {
      setAvatarPreviewUrl(avatarUrl ?? null);
    }
  }, [avatarUrl, selectedAvatarFile]);
  React.useEffect(() => {
    if (!selectedAvatarFile) return;
    const objectUrl = URL.createObjectURL(selectedAvatarFile);
    setAvatarPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedAvatarFile]);

  React.useEffect(() => {
    if (avatarState.ok) {
      toast.success(avatarState.message ?? "Photo saved");
      setSelectedAvatarName("");
      setSelectedAvatarFile(null);
      avatarFormRef.current?.reset();
      router.refresh();
    } else if (avatarState.error) {
      toast.error(avatarState.error);
    }
  }, [avatarState, router]);

  React.useEffect(() => {
    if (taxState.ok) {
      toast.success(taxState.message ?? "Tax & fee settings saved");
      router.refresh();
    } else if (taxState.error) {
      toast.error(taxState.error);
    }
  }, [taxState, router]);

  async function saveAccountDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (demo || accountPending) return;

    setAccountError(null);
    setAccountPending(true);

    try {
      const trimmedName = nameValue.trim();
      const trimmedEmail = emailValue.trim().toLowerCase();
      const currentName = (displayName ?? "").trim();
      const currentEmail = (email ?? "").trim().toLowerCase();
      const nameChanged = trimmedName !== currentName;
      const emailChanged = trimmedEmail !== currentEmail;
      const passwordFilled = password.length > 0 || confirmPassword.length > 0;

      if (!nameChanged && !emailChanged && !passwordFilled) {
        toast.message("Nothing to save");
        return;
      }

      const messages: string[] = [];

      if (nameChanged) {
        const fd = new FormData();
        fd.set("displayName", trimmedName);
        const result = await updateAccountProfile({}, fd);
        if (result.error) {
          setAccountError(result.error);
          toast.error(result.error);
          return;
        }
        if (result.message) messages.push(result.message);
      }

      if (emailChanged) {
        const fd = new FormData();
        fd.set("email", trimmedEmail);
        const result = await updateAccountEmail({}, fd);
        if (result.error) {
          setAccountError(result.error);
          toast.error(result.error);
          return;
        }
        if (result.message) messages.push(result.message);
      }

      if (passwordFilled) {
        const fd = new FormData();
        fd.set("password", password);
        fd.set("confirmPassword", confirmPassword);
        const result = await updateAccountPassword({}, fd);
        if (result.error) {
          setAccountError(result.error);
          toast.error(result.error);
          return;
        }
        setPassword("");
        setConfirmPassword("");
        if (result.message) messages.push(result.message);
      }

      toast.success(messages[0] ?? "Profile saved");
      for (const message of messages.slice(1)) {
        toast.success(message);
      }
      router.refresh();
    } finally {
      setAccountPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Section 1 — Profile photo */}
      <Card variant="feature" className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-bold">Profile photo</CardTitle>
          <CardDescription>Choose a clear square image for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={avatarFormRef} action={avatarAction} className="space-y-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={demo || avatarPending}
                className="group relative mx-auto size-28 shrink-0 overflow-hidden rounded-3xl bg-primary/5 ring-1 ring-border/60 transition hover:ring-primary/40 sm:mx-0 sm:size-32"
                aria-label="Select profile photo"
              >
                {avatarPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic blob/storage preview works best with a native image here.
                  <img
                    src={avatarPreviewUrl}
                    alt={displayName ?? email ?? "Account"}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-primary/10 text-3xl font-semibold text-primary">
                    {initials(displayName, email)}
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-foreground/70 py-1.5 text-[11px] font-medium text-background opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Camera className="size-3.5" />
                  Change
                </span>
              </button>

              <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
                <div className="space-y-1">
                  <p className="truncate text-base font-semibold text-foreground">
                    {displayName ?? "Your profile"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {email ?? "No email available"}
                  </p>
                </div>

                <Input
                  ref={avatarInputRef}
                  id="account-avatar"
                  name="avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setSelectedAvatarFile(file);
                    setSelectedAvatarName(file?.name?.trim() ?? "");
                  }}
                />

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={demo || avatarPending}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <ImagePlus className="size-4" />
                    {selectedAvatarName ? "Choose another" : "Select image"}
                  </Button>
                  {selectedAvatarFile ? (
                    <Button type="submit" className="h-10" disabled={demo || avatarPending}>
                      {avatarPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save photo
                    </Button>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">
                  {selectedAvatarName && selectedAvatarFile
                    ? `${selectedAvatarName} · ${formatFileSize(selectedAvatarFile.size)}`
                    : "JPG, PNG, or WebP up to 2 MB."}
                </p>
              </div>
            </div>

            {avatarState.error ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{avatarState.error}</p>
            ) : null}
            {demo ? (
              <p className="text-sm text-muted-foreground">
                Demo mode is active, so profile updates are disabled until real auth is connected.
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Section 2 — Name, email, password */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-bold">Account details</CardTitle>
          <CardDescription>
            Update your name, email, and password in one place. Leave password blank to keep your
            current one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveAccountDetails} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="account-display-name" className="text-sm font-medium">
                Full name
              </label>
              <Input
                id="account-display-name"
                name="displayName"
                value={nameValue}
                onChange={(event) => setNameValue(event.target.value)}
                placeholder="Your full name"
                className="h-11"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="account-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="account-email"
                name="email"
                type="email"
                value={emailValue}
                onChange={(event) => setEmailValue(event.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Changing email sends a confirmation link before the new address becomes active.
              </p>
            </div>

            <div className="grid gap-4 border-t border-border/70 pt-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="account-password" className="text-sm font-medium">
                  New password
                </label>
                <Input
                  id="account-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="account-confirm-password" className="text-sm font-medium">
                  Confirm password
                </label>
                <Input
                  id="account-confirm-password"
                  name="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  className="h-11"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="h-11" disabled={demo || accountPending}>
                {accountPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
            </div>

            {accountError ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{accountError}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Section 3 — Tax & fees */}
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-bold">Tax &amp; fees</CardTitle>
          <CardDescription>
            Used for WHT on dividends, CGT on realized gains, and default trade fees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={taxAction} className="space-y-6">
            <input type="hidden" name="taxFiler" value={String(taxFiler)} />
            <input type="hidden" name="zakatOnDividends" value={String(zakatEnabled)} />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Tax filing status</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTaxFiler(true)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    taxFiler
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <div className="text-sm font-semibold">Filer</div>
                  <div className="mt-0.5 text-xs opacity-70">WHT 15% · CGT 15%</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTaxFiler(false)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    !taxFiler
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <div className="text-sm font-semibold">Non-Filer</div>
                  <div className="mt-0.5 text-xs opacity-70">WHT 30% · CGT 30%</div>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brokerFeePct" className="text-sm font-medium">
                Default broker fee
              </Label>
              <div className="relative max-w-48">
                <Input
                  id="brokerFeePct"
                  name="brokerFeePct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  value={brokerFeePct}
                  onChange={(e) => setBrokerFeePct(e.target.value)}
                  className="h-11 pr-8"
                  placeholder="0.20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pre-fills the fee field when you add a new trade.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/10 px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="zakatToggle" className="text-sm font-medium">
                  Deduct Zakat on dividends
                </Label>
                <p className="text-xs text-muted-foreground">Applies 2.5% Zakat to gross dividend income.</p>
              </div>
              <Switch id="zakatToggle" checked={zakatEnabled} onCheckedChange={setZakatEnabled} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cgtOverride" className="text-sm font-medium">
                CGT rate override{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <div className="relative max-w-48">
                <Input
                  id="cgtOverride"
                  name="cgtRateOverride"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={cgtOverride}
                  onChange={(e) => setCgtOverride(e.target.value)}
                  className="h-11 pr-8"
                  placeholder={taxFiler ? "15" : "30"}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to use the statutory rate ({taxFiler ? "15%" : "30%"} for{" "}
                {taxFiler ? "filers" : "non-filers"}).
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="h-11" disabled={demo || taxPending}>
                {taxPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
            </div>
            {taxState.error ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{taxState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
