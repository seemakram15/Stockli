import "server-only";

import { parse } from "node-html-parser";
import { getStaleCached } from "@/lib/cache/stale";

export interface FuelCurrentEntry {
  label: string;
  oldPrice: number | null;
  newPrice: number | null;
  signedChange: number | null;
}

export interface FuelHistoryEntry {
  date: string;
  price: number;
}

export interface PakistanFuelData {
  effectiveDate: string;
  current: FuelCurrentEntry[];
  history: FuelHistoryEntry[];
  updatedAt: string;
}

export async function getPakistanFuelPrices(): Promise<PakistanFuelData> {
  const { value } = await getStaleCached({
    key: "public:pk-fuel-prices-v1",
    ttlSeconds: 6 * 60 * 60,
    staleSeconds: 7 * 24 * 60 * 60,
    load: fetchAndParse,
  });
  return value;
}

async function fetchAndParse(): Promise<PakistanFuelData> {
  const res = await fetch("https://www.pakwheels.com/petroleum-prices-in-pakistan", {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PakWheels responded ${res.status}`);
  const html = await res.text();
  return parseHtml(html);
}

function parsePrice(text: string): number | null {
  const n = parseFloat(text.replace(/PKR\s*/i, "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDateToIso(raw: string): string | null {
  const cleaned = raw.replace(",", " ").replace(/\s+/g, " ").trim();
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseHtml(html: string): PakistanFuelData {
  const root = parse(html);

  const effectiveDateMatch = root.text.match(/w\.e\.f\s+([\d\w\-]+)/i);
  const effectiveDate = effectiveDateMatch ? effectiveDateMatch[1].trim() : "";

  const tables = root.querySelectorAll("table");

  const current: FuelCurrentEntry[] = [];
  if (tables[0]) {
    const rows = tables[0].querySelectorAll("tr");
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td");
      if (cells.length < 3) continue;
      const label = cells[0].text.trim();
      const oldPrice = parsePrice(cells[1].text);
      const newPrice = parsePrice(cells[2].text);
      const signedChange =
        oldPrice != null && newPrice != null ? newPrice - oldPrice : null;
      current.push({ label, oldPrice, newPrice, signedChange });
    }
  }

  const history: FuelHistoryEntry[] = [];
  if (tables[1]) {
    const rows = tables[1].querySelectorAll("tr");
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td");
      if (cells.length < 2) continue;
      const date = parseDateToIso(cells[0].text.trim());
      const price = parseFloat(cells[1].text.replace(/[^\d.]/g, ""));
      if (date && Number.isFinite(price) && price > 0) {
        history.push({ date, price });
      }
    }
  }

  return {
    effectiveDate,
    current,
    history,
    updatedAt: new Date().toISOString(),
  };
}
