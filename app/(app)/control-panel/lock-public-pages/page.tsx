import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PAGE_REGISTRY } from "@/lib/access/page-registry";
import {
  GUEST_BROWSING_KEY,
  GUEST_POPUP_KEY,
  getAppSettings,
  pageSettingKey,
} from "@/lib/services/app-settings";
import { CustomisationEditor } from "@/components/admin/customisation-editor";

export const metadata: Metadata = { title: "Lock Public Pages" };
export const dynamic = "force-dynamic";

export default async function LockPublicPagesPage() {
  const settings = await getAppSettings();

  const pages = PAGE_REGISTRY.map((entry) => ({
    key: entry.key,
    label: entry.label,
    href: entry.href,
    kind: entry.kind,
    enabled: settings.isPageEnabled(entry.key),
    settingKey: pageSettingKey(entry.key),
  })).sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        icon={<Settings />}
        accent="violet"
        eyebrow="Control Panel"
        title="Lock Public Pages"
        description="Control public/guest browsing site-wide, and lock individual pages behind login."
      />
      <CustomisationEditor
        guestBrowsingEnabled={settings.guestBrowsingEnabled}
        guestBrowsingKey={GUEST_BROWSING_KEY}
        guestPopupEnabled={settings.guestPopupEnabled}
        guestPopupKey={GUEST_POPUP_KEY}
        pages={pages}
      />
    </div>
  );
}
