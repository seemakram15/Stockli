import { redirect } from "next/navigation";

export default function AdminCustomisationRedirectPage() {
  redirect("/control-panel/lock-public-pages");
}
