/**
 * A curated seed of well-known PSX listings. Used to:
 *  - seed the `tickers` table (supabase/migrations/0003_seed_tickers.sql),
 *  - power search & demo data before a live /market-watch scrape runs.
 *
 * The live scraper refreshes/extends this set; this is just a sensible base.
 */

export interface SeedTicker {
  symbol: string;
  company: string;
  sector: string;
  /** A rough reference price (PKR) to anchor demo series — not authoritative. */
  ref: number;
}

export const SEED_TICKERS: SeedTicker[] = [
  { symbol: "OGDC", company: "Oil & Gas Development Co.", sector: "Oil & Gas Exploration", ref: 178 },
  { symbol: "PPL", company: "Pakistan Petroleum Ltd.", sector: "Oil & Gas Exploration", ref: 118 },
  { symbol: "POL", company: "Pakistan Oilfields Ltd.", sector: "Oil & Gas Exploration", ref: 560 },
  { symbol: "MARI", company: "Mari Petroleum Co.", sector: "Oil & Gas Exploration", ref: 620 },
  { symbol: "PSO", company: "Pakistan State Oil Co.", sector: "Oil & Gas Marketing", ref: 365 },
  { symbol: "APL", company: "Attock Petroleum Ltd.", sector: "Oil & Gas Marketing", ref: 480 },
  { symbol: "HASCOL", company: "Hascol Petroleum Ltd.", sector: "Oil & Gas Marketing", ref: 9 },
  { symbol: "LUCK", company: "Lucky Cement Ltd.", sector: "Cement", ref: 1080 },
  { symbol: "DGKC", company: "D.G. Khan Cement Co.", sector: "Cement", ref: 96 },
  { symbol: "MLCF", company: "Maple Leaf Cement Factory", sector: "Cement", ref: 58 },
  { symbol: "FCCL", company: "Fauji Cement Co.", sector: "Cement", ref: 27 },
  { symbol: "CHCC", company: "Cherat Cement Co.", sector: "Cement", ref: 198 },
  { symbol: "ENGRO", company: "Engro Corporation Ltd.", sector: "Fertilizer", ref: 295 },
  { symbol: "FFC", company: "Fauji Fertilizer Co.", sector: "Fertilizer", ref: 142 },
  { symbol: "EFERT", company: "Engro Fertilizers Ltd.", sector: "Fertilizer", ref: 165 },
  { symbol: "FFBL", company: "Fauji Fertilizer Bin Qasim", sector: "Fertilizer", ref: 38 },
  { symbol: "HBL", company: "Habib Bank Ltd.", sector: "Commercial Banks", ref: 138 },
  { symbol: "UBL", company: "United Bank Ltd.", sector: "Commercial Banks", ref: 285 },
  { symbol: "MCB", company: "MCB Bank Ltd.", sector: "Commercial Banks", ref: 245 },
  { symbol: "BAHL", company: "Bank Al Habib Ltd.", sector: "Commercial Banks", ref: 92 },
  { symbol: "MEBL", company: "Meezan Bank Ltd.", sector: "Commercial Banks", ref: 215 },
  { symbol: "BAFL", company: "Bank Alfalah Ltd.", sector: "Commercial Banks", ref: 68 },
  { symbol: "ABL", company: "Allied Bank Ltd.", sector: "Commercial Banks", ref: 125 },
  { symbol: "NBP", company: "National Bank of Pakistan", sector: "Commercial Banks", ref: 48 },
  { symbol: "ENGROH", company: "Engro Holdings Ltd.", sector: "Holding Companies", ref: 188 },
  { symbol: "PSEL", company: "Pak Suzuki Motor Co.", sector: "Automobile Assembler", ref: 720 },
  { symbol: "INDU", company: "Indus Motor Company Ltd.", sector: "Automobile Assembler", ref: 1650 },
  { symbol: "HCAR", company: "Honda Atlas Cars (Pak) Ltd.", sector: "Automobile Assembler", ref: 310 },
  { symbol: "MTL", company: "Millat Tractors Ltd.", sector: "Automobile Assembler", ref: 760 },
  { symbol: "SYS", company: "Systems Ltd.", sector: "Technology & Communication", ref: 410 },
  { symbol: "TRG", company: "TRG Pakistan Ltd.", sector: "Technology & Communication", ref: 62 },
  { symbol: "AVN", company: "Avanceon Ltd.", sector: "Technology & Communication", ref: 78 },
  { symbol: "NETSOL", company: "NetSol Technologies Ltd.", sector: "Technology & Communication", ref: 96 },
  { symbol: "PTC", company: "Pakistan Telecommunication Co.", sector: "Technology & Communication", ref: 18 },
  { symbol: "SEARL", company: "The Searle Company Ltd.", sector: "Pharmaceuticals", ref: 92 },
  { symbol: "AGP", company: "AGP Ltd.", sector: "Pharmaceuticals", ref: 110 },
  { symbol: "HINOON", company: "Highnoon Laboratories Ltd.", sector: "Pharmaceuticals", ref: 720 },
  { symbol: "NESTLE", company: "Nestle Pakistan Ltd.", sector: "Food & Personal Care", ref: 7200 },
  { symbol: "NATF", company: "National Foods Ltd.", sector: "Food & Personal Care", ref: 215 },
  { symbol: "UNITY", company: "Unity Foods Ltd.", sector: "Food & Personal Care", ref: 26 },
  { symbol: "HUBC", company: "Hub Power Company Ltd.", sector: "Power Generation & Distribution", ref: 142 },
  { symbol: "KAPCO", company: "Kot Addu Power Co.", sector: "Power Generation & Distribution", ref: 35 },
  { symbol: "KEL", company: "K-Electric Ltd.", sector: "Power Generation & Distribution", ref: 4.6 },
  { symbol: "ISL", company: "International Steels Ltd.", sector: "Engineering", ref: 78 },
  { symbol: "ASTL", company: "Amreli Steels Ltd.", sector: "Engineering", ref: 32 },
  { symbol: "PIOC", company: "Pioneer Cement Ltd.", sector: "Cement", ref: 145 },
];

export const SEED_SYMBOLS = SEED_TICKERS.map((t) => t.symbol);

export function getSeedTicker(symbol: string): SeedTicker | undefined {
  return SEED_TICKERS.find((t) => t.symbol === symbol.toUpperCase());
}
