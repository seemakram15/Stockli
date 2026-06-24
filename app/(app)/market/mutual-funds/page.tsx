import type { Metadata } from "next";
import { CachedMufapPage } from "@/components/public-data/cached-mufap-page";

export const metadata: Metadata = { title: "Mutual Funds" };

export default function MutualFundsPage() {
  return <CachedMufapPage kind="mutual" />;
}
