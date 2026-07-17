import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AccountSettingsPanel } from "@/components/account/account-settings-panel";
import { AccountDangerZone } from "@/components/account/account-danger-zone";
import { getSessionContext } from "@/lib/auth/roles";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { defaultTaxSettings } from "@/lib/services/tax";
import type { TaxSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

async function fetchTaxSettings(userId: string): Promise<TaxSettings> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("tax_filer, broker_fee_pct, zakat_on_dividends, cgt_rate_override")
      .eq("id", userId)
      .single();
    if (!data) return defaultTaxSettings();
    return {
      taxFiler: data.tax_filer ?? false,
      brokerFeePct: data.broker_fee_pct ?? 0.2,
      zakatOnDividends: data.zakat_on_dividends ?? false,
      cgtRateOverride: data.cgt_rate_override ?? null,
    };
  } catch {
    return defaultTaxSettings();
  }
}

export default async function AccountPage() {
  const { user } = await getSessionContext();
  const taxSettings = user ? await fetchTaxSettings(user.id) : defaultTaxSettings();

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
        taxSettings={taxSettings}
        demo={isDemoMode}
      />

      <AccountDangerZone email={user?.email ?? null} demo={isDemoMode} />
    </div>
  );
}
