import "server-only";

import { getStaleCached } from "@/lib/cache/stale";

export interface PkRawMaterialPrice {
  label: string;
  category: "construction" | "fertilizer" | "agriculture" | "energy";
  price: number | null;
  unit: string;
}

export interface PkRawMaterialsData {
  items: PkRawMaterialPrice[];
  updatedAt: string;
  source: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Finds the first price in range [min,max] that appears within 2000 chars after `keyword`.
// Handles comma-formatted numbers (1,540) and plain numbers (260).
// Returns midpoint when two close values appear together (range format like "260-265" or "260 to 265").
function findPrice(html: string, keyword: string, min: number, max: number): number | null {
  const idx = html.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return null;

  const chunk = html.slice(idx, idx + 2000);
  const nums: number[] = [];
  // Match comma-separated (1,540) OR plain integers (260) — captures 2+ digit numbers
  const re = /\b(\d{1,2},\d{3}(?:,\d{3})*|\d{2,7})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    if (n >= min && n <= max) nums.push(n);
  }
  if (nums.length === 0) return null;
  // If two values are within 15% of each other it's a price range → return midpoint
  if (nums.length >= 2 && nums[1] - nums[0] <= nums[0] * 0.15) {
    return Math.round((nums[0] + nums[1]) / 2);
  }
  return nums[0];
}

function avgOf(...vals: (number | null)[]): number | null {
  const good = vals.filter((v): v is number => v !== null);
  if (good.length === 0) return null;
  return Math.round(good.reduce((a, b) => a + b, 0) / good.length);
}

async function fetchLive(): Promise<PkRawMaterialsData> {
  const [cementHtml, fertHtml, steelHtml, sugarHtml, wheatHtml, coalHtml] = await Promise.all([
    fetchHtml("https://materialrate.pk/cement-rate-today/"),
    fetchHtml("https://kissanshop.com/fertilizer-price-in-pakistan/"),
    fetchHtml("https://icons.com.pk/steel-rate-today"),
    fetchHtml("https://pointshift.pk/sugar-price-in-pakistan-today/"),
    fetchHtml("https://tractors.com.pk/wheat-price-pakistan-today/"),
    fetchHtml("https://procarepk.com/coal-price-in-pakistan/")
      .then(h => h ?? fetchHtml("https://brecorder.com/commodities/minerals-metals")),
  ]);

  // Cement: average of major brands per 50kg bag (~Rs 1,520–1,560)
  const cementPrice = avgOf(
    cementHtml ? findPrice(cementHtml, "Lucky", 1000, 2500) : null,
    cementHtml ? findPrice(cementHtml, "Bestway", 1000, 2500) : null,
    cementHtml ? findPrice(cementHtml, "DG Khan", 1000, 2500) : null,
    cementHtml ? findPrice(cementHtml, "Fauji", 1000, 2500) : null,
  );

  // Steel G60 per kg (~Rs 258–265)
  const steelPrice = steelHtml
    ? (findPrice(steelHtml, "grade 60", 200, 400) ??
       findPrice(steelHtml, "60 grade", 200, 400) ??
       findPrice(steelHtml, "g-60", 200, 400) ??
       findPrice(steelHtml, "saria", 200, 400) ??
       findPrice(steelHtml, "per kg", 200, 400))
    : null;

  // Fertilizers per 50kg bag
  const ureaPrice = fertHtml
    ? (findPrice(fertHtml, "Sona Urea", 3000, 7000) ?? findPrice(fertHtml, "Engro Urea", 3000, 7000))
    : null;
  const dapPrice = fertHtml
    ? (findPrice(fertHtml, "Sona DAP", 10000, 20000) ?? findPrice(fertHtml, "Engro DAP", 10000, 20000))
    : null;

  // Sugar per kg (~Rs 145–172)
  const sugarPrice = sugarHtml
    ? (findPrice(sugarHtml, "per kg", 80, 350) ??
       findPrice(sugarHtml, "price", 80, 350) ??
       findPrice(sugarHtml, "sugar", 80, 350))
    : null;

  // Wheat per 40kg bag (~Rs 3,200–3,600; support price Rs 3,500)
  const wheatPrice = wheatHtml
    ? (findPrice(wheatHtml, "40 kg", 1000, 6000) ??
       findPrice(wheatHtml, "40kg", 1000, 6000) ??
       findPrice(wheatHtml, "wheat", 1000, 6000))
    : null;

  // Coal per metric ton — Pakistan imports thermal coal (~Rs 35,000–70,000/MT)
  const coalPrice = coalHtml
    ? (findPrice(coalHtml, "per metric ton", 20000, 150000) ??
       findPrice(coalHtml, "metric ton", 20000, 150000) ??
       findPrice(coalHtml, "per ton", 20000, 150000) ??
       findPrice(coalHtml, "coal", 20000, 150000))
    : null;

  const items: PkRawMaterialPrice[] = [
    { label: "Cement (Grey)", category: "construction", price: cementPrice, unit: "per 50kg bag" },
    { label: "Steel Saria (G60)", category: "construction", price: steelPrice, unit: "per kg" },
    { label: "Urea", category: "fertilizer", price: ureaPrice, unit: "per 50kg bag" },
    { label: "DAP Fertilizer", category: "fertilizer", price: dapPrice, unit: "per 50kg bag" },
    { label: "Wheat / Gandum", category: "agriculture", price: wheatPrice, unit: "per 40kg" },
    { label: "Sugar / Cheeni", category: "agriculture", price: sugarPrice, unit: "per kg" },
    { label: "Coal (Imported)", category: "energy", price: coalPrice, unit: "per MT" },
  ];

  return {
    items,
    updatedAt: new Date().toISOString(),
    source: "materialrate.pk · kissanshop.com · icons.com.pk · tractors.com.pk · procarepk.com",
  };
}

export async function getPakistanRawMaterials(): Promise<PkRawMaterialsData> {
  const { value } = await getStaleCached({
    key: "public:pk-raw-materials-v3",
    ttlSeconds: 6 * 60 * 60,
    staleSeconds: 7 * 24 * 60 * 60,
    load: fetchLive,
  });
  return value;
}
