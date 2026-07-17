"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, LockKeyhole, Mail, ReceiptText, Save, UserRound } from "lucide-react";
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

  const [profileState, profileAction, profilePending] = useActionState<AccountActionState, FormData>(
    updateAccountProfile,
    {}
  );
  const [avatarState, avatarAction, avatarPending] = useActionState<AccountActionState, FormData>(
    updateAccountAvatar,
    {}
  );
  const [emailState, emailAction, emailPending] = useActionState<AccountActionState, FormData>(
    updateAccountEmail,
    {}
  );
  const [passwordState, passwordAction, passwordPending] = useActionState<
    AccountActionState,
    FormData
  >(updateAccountPassword, {});

  const [taxState, taxAction, taxPending] = useActionState<AccountActionState, FormData>(
    updateTaxSettings,
    {}
  );

  const [nameValue, setNameValue] = React.useState(displayName ?? "");
  const [emailValue, setEmailValue] = React.useState(email ?? "");
  const [selectedAvatarName, setSelectedAvatarName] = React.useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = React.useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = React.useState<string | null>(avatarUrl);
  const avatarFormRef = React.useRef<HTMLFormElement>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const passwordFormRef = React.useRef<HTMLFormElement>(null);

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
    if (profileState.ok) {
      toast.success(profileState.message ?? "Saved");
      router.refresh();
    } else if (profileState.error) {
      toast.error(profileState.error);
    }
  }, [profileState, router]);

  React.useEffect(() => {
    if (avatarState.ok) {
      toast.success(avatarState.message ?? "Saved");
      setSelectedAvatarName("");
      setSelectedAvatarFile(null);
      avatarFormRef.current?.reset();
      router.refresh();
    } else if (avatarState.error) {
      toast.error(avatarState.error);
    }
  }, [avatarState, router]);

  React.useEffect(() => {
    if (emailState.ok) {
      toast.success(emailState.message ?? "Saved");
      router.refresh();
    } else if (emailState.error) {
      toast.error(emailState.error);
    }
  }, [emailState, router]);

  React.useEffect(() => {
    if (passwordState.ok) {
      toast.success(passwordState.message ?? "Saved");
      passwordFormRef.current?.reset();
    } else if (passwordState.error) {
      toast.error(passwordState.error);
    }
  }, [passwordState]);

  React.useEffect(() => {
    if (taxState.ok) {
      toast.success(taxState.message ?? "Tax settings saved.");
      router.refresh();
    } else if (taxState.error) {
      toast.error(taxState.error);
    }
  }, [taxState, router]);

  return (
    <div className="space-y-6">
      <Card variant="feature">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="size-4 text-primary" />
            Profile photo
          </CardTitle>
          <CardDescription>
            Add a clear square image so your account feels personal anywhere you sign in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-center gap-5 rounded-3xl border border-dashed border-border bg-muted/15 px-6 py-8 text-center md:gap-6 md:py-10">
            <div className="rounded-[2rem] bg-background/90 p-3 shadow-sm ring-1 ring-border/60">
              <div className="relative flex size-56 items-center justify-center overflow-hidden rounded-[1.6rem] bg-primary/5 md:size-72">
                {avatarPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic blob/storage preview works best with a native image here.
                  <img
                    src={avatarPreviewUrl}
                    alt={displayName ?? email ?? "Account"}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-primary/10 text-5xl font-semibold text-primary md:text-6xl">
                    {initials(displayName, email)}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Current profile photo
              </p>
              <p className="text-lg font-semibold text-foreground">{displayName ?? "Account"}</p>
              <p className="text-sm text-muted-foreground">{email ?? "No email available"}</p>
            </div>
          </div>

          <form ref={avatarFormRef} action={avatarAction} className="space-y-4">
            <div className="space-y-3">
              <label htmlFor="account-avatar" className="text-sm font-medium">
                Choose profile image
              </label>
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
              <div className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {selectedAvatarName ? "Image ready to upload" : "Pick a new profile photo"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAvatarName && selectedAvatarFile
                        ? `${selectedAvatarName} • ${formatFileSize(selectedAvatarFile.size)}`
                        : "Use a clear square image so it looks sharp across your account."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 px-4"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <ImagePlus className="size-4" />
                    {selectedAvatarName ? "Change image" : "Choose image"}
                  </Button>
                </div>
                <div className="mt-3 rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  JPG, PNG, or WebP up to 2 MB.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className="h-11" disabled={demo || avatarPending}>
                {avatarPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                Upload photo
              </Button>
              {demo ? (
                <p className="text-sm text-muted-foreground">
                  Demo mode is active, so profile updates are disabled until real auth is connected.
                </p>
              ) : null}
            </div>
            {avatarState.error ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{avatarState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" />
            Profile details
          </CardTitle>
          <CardDescription>Update the name people see across your Stockli account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={profileAction} className="space-y-4">
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
            <div className="flex justify-end">
              <Button type="submit" className="h-11" disabled={demo || profilePending}>
                {profilePending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save changes
              </Button>
            </div>
            {profileState.error ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{profileState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            Email address
          </CardTitle>
          <CardDescription>
            Change your sign-in email. We will ask you to confirm the new address before it goes
            live.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={emailAction} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="account-current-email" className="text-sm font-medium">
                Current email
              </label>
              <Input
                id="account-current-email"
                value={email ?? ""}
                readOnly
                className="h-11 bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="account-email" className="text-sm font-medium">
                New email address
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
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="h-11" disabled={demo || emailPending}>
                {emailPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Update email
              </Button>
            </div>
            {emailState.error ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{emailState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-4 text-primary" />
            Tax &amp; fees
          </CardTitle>
          <CardDescription>
            Set your Pakistan tax filing status and default broker fee. These are used to calculate
            WHT on dividends, CGT on realized gains, and to pre-fill fees when adding trades.
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
              <Switch
                id="zakatToggle"
                checked={zakatEnabled}
                onCheckedChange={setZakatEnabled}
              />
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
                Leave blank to use the statutory rate ({taxFiler ? "15%" : "30%"} for {taxFiler ? "filers" : "non-filers"}).
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" className="h-11" disabled={demo || taxPending}>
                {taxPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save tax settings
              </Button>
            </div>
            {taxState.error ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{taxState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-primary" />
            Change password
          </CardTitle>
          <CardDescription>
            Choose a new password for your account. Use at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={passwordFormRef} action={passwordAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="account-password" className="text-sm font-medium">
                  New password
                </label>
                <Input
                  id="account-password"
                  name="password"
                  type="password"
                  placeholder="New password"
                  className="h-11"
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
                  placeholder="Confirm password"
                  className="h-11"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" className="h-11" disabled={demo || passwordPending}>
                {passwordPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LockKeyhole className="size-4" />
                )}
                Update password
              </Button>
            </div>
            {passwordState.error ? (
              <p className="rounded-lg bg-loss/10 px-3 py-2 text-sm text-loss">{passwordState.error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
