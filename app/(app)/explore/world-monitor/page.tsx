import type { Metadata } from "next";
import { WorldMonitorDashboard } from "@/components/explore/world-monitor-dashboard";

export const metadata: Metadata = {
  title: "World Monitor",
  description:
    "Follow global conflict hotspots, disaster alerts, and live market stress on one world map.",
};

export default function WorldMonitorPage() {
  return <WorldMonitorDashboard />;
}
