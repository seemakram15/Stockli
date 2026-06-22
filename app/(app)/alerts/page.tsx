import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { getAlerts } from "@/lib/services/portfolio";
import { isDemoMode } from "@/lib/config";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { AlertsList } from "@/components/alerts/alerts-list";
import { CreateAlertDialog } from "@/components/alerts/create-alert-dialog";

export const metadata: Metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const alerts = await getAlerts();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Price alerts"
        description="Get notified when a stock crosses your target. Evaluated each refresh (~15 min)."
        actions={<CreateAlertDialog />}
      />

      {alerts.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" />}
          title="No alerts yet"
          description="Create a price alert to track when a stock rises above or falls below a target."
          action={<CreateAlertDialog />}
        />
      ) : (
        <Card>
          <CardContent className="px-4 sm:px-6">
            <AlertsList alerts={alerts} demo={isDemoMode} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
