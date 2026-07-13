import type { Metadata } from "next";
import { CachedFundsBreakdownPage } from "@/components/public-data/cached-funds-breakdown-page";

export const metadata: Metadata = { title: "Funds Breakdown" };

export default function FundsBreakdownPage() {
  return <CachedFundsBreakdownPage />;
}
