import { redirect } from "next/navigation";

export default function AdminFundHoldingsRedirectPage() {
  redirect("/control-panel/edit-funds-holdings");
}
