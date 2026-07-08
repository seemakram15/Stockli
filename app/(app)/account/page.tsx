import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AccountSettingsPanel } from "@/components/account/account-settings-panel";
import { AccountDangerZone } from "@/components/account/account-danger-zone";
import { getSessionContext } from "@/lib/auth/roles";
import { isDemoMode } from "@/lib/config";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user } = await getSessionContext();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={<ShieldCheck />}
        eyebrow="Account settings"
        accent="emerald"
        title="Account settings"
        description="Update your photo, name, email, password, and permanent account actions from one place."
      />

      <AccountSettingsPanel
        displayName={user?.displayName ?? null}
        email={user?.email ?? null}
        avatarUrl={user?.avatarUrl ?? null}
        demo={isDemoMode}
      />

      <AccountDangerZone email={user?.email ?? null} demo={isDemoMode} />
    </div>
  );
}
