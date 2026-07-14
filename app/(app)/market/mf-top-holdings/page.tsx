import type { Metadata } from "next";
import { CachedMFTopHoldingsPage } from "@/components/public-data/cached-mf-top-holdings-page";

export const metadata: Metadata = { title: "Top Holdings by Mutual Funds" };

export default function MFTopHoldingsPage() {
  return <CachedMFTopHoldingsPage />;
}
