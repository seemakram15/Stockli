import { redirect } from "next/navigation";

/** Legacy URL — permanently moved to Control Panel. */
export default function AdminRedirectPage() {
  redirect("/control-panel/users");
}
