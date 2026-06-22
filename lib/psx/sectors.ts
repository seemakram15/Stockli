/**
 * PSX `/market-watch` returns the sector as a numeric code (e.g. "0820"), not a
 * name. This maps the codes to human names so the UI never shows a number.
 *
 * The map was derived empirically by cross-referencing the live feed against
 * known listings. Only high-confidence, conflict-free codes are included;
 * anything unrecognised resolves to "Other" rather than leaking a raw code.
 */
export const PSX_SECTOR_NAMES: Record<string, string> = {
  "0801": "Automobile Assembler",
  "0802": "Automobile Parts & Accessories",
  "0803": "Cable & Electrical Goods",
  "0804": "Cement",
  "0805": "Chemical",
  "0806": "Close-End Mutual Fund",
  "0807": "Commercial Banks",
  "0808": "Engineering",
  "0809": "Fertilizer",
  "0810": "Food & Personal Care Products",
  "0811": "Glass & Ceramics",
  "0812": "Insurance",
  "0813": "Holding Companies",
  "0816": "Leather & Tanneries",
  "0818": "Miscellaneous",
  "0819": "Modarabas",
  "0820": "Oil & Gas Exploration Companies",
  "0821": "Oil & Gas Marketing Companies",
  "0822": "Paper, Board & Packaging",
  "0823": "Pharmaceuticals",
  "0824": "Power Generation & Distribution",
  "0825": "Refinery",
  "0826": "Sugar & Allied Industries",
  "0827": "Synthetic & Rayon",
  "0828": "Technology & Communication",
  "0829": "Textile Composite",
  "0830": "Textile Spinning",
  "0832": "Tobacco",
  "0833": "Transport",
  "0836": "Real Estate Investment Trust",
  "0837": "Exchange Traded Funds",
};

/**
 * Resolve a raw sector value to a display name.
 *  - known numeric code → mapped name
 *  - unknown numeric code → "Other" (never show a bare number)
 *  - already a name → passed through (resilient if PSX changes the format)
 */
export function sectorName(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const v = raw.trim();
  if (v === "") return "Other";
  if (PSX_SECTOR_NAMES[v]) return PSX_SECTOR_NAMES[v];
  if (/^\d+$/.test(v)) return "Other";
  return v;
}
