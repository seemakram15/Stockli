import type { Metadata } from "next";
import { ServersMonitorPage } from "@/components/control-panel/servers-monitor-page";

export const metadata: Metadata = { title: "Servers" };
export const dynamic = "force-dynamic";

export default function ServersPage() {
  return <ServersMonitorPage />;
}
