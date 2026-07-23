/**
 * Curated "what's new" bullets shown in the post-login account warmup popup.
 * Edit this list when shipping notable product changes — no CMS required.
 */
export type ProductUpdate = {
  id: string;
  title: string;
  body: string;
};

export const IMPORTANT_PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "broker-statement-import",
    title: "Import broker statements",
    body: "Paste or upload a statement to add buys, sells, and dividends in one pass.",
  },
  {
    id: "stock-overview",
    title: "Richer stock profiles",
    body: "Company overview, key people, and payout history now load beside fundamentals.",
  },
  {
    id: "faster-icons",
    title: "Faster company icons",
    body: "Logos for your holdings are cached at sign-in so lists open without waiting.",
  },
];
