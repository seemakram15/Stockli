import { redirect } from "next/navigation";

export default function ControlPanelIndexPage() {
  redirect("/control-panel/servers");
}
