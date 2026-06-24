import type { Metadata } from "next";
import { CachedMufapPage } from "@/components/public-data/cached-mufap-page";

export const metadata: Metadata = { title: "Exchange Traded Funds" };

export default function ExchangeTradedFundsPage() {
  return <CachedMufapPage kind="etfs" />;
}
