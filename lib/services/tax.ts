import type { TaxSettings } from "@/lib/types";

const WHT_FILER = 0.15;
const WHT_NONFILER = 0.30;
const CGT_FILER = 0.15;
const CGT_NONFILER = 0.30;
const ZAKAT_RATE = 0.025;

export function getWHTRate(taxFiler: boolean): number {
  return taxFiler ? WHT_FILER : WHT_NONFILER;
}

export function getCGTRate(settings: TaxSettings): number {
  if (settings.cgtRateOverride !== null) return settings.cgtRateOverride / 100;
  return settings.taxFiler ? CGT_FILER : CGT_NONFILER;
}

export function calcDividendTaxes(
  gross: number,
  settings: TaxSettings
): { wht: number; zakat: number; net: number } {
  const wht = gross * getWHTRate(settings.taxFiler);
  const zakat = settings.zakatOnDividends ? gross * ZAKAT_RATE : 0;
  return { wht, zakat, net: gross - wht - zakat };
}

/** Round PKR amounts to 2 dp (CDC report style). */
function roundPkr(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Derive CDC "Add Manually" amounts from rate × securities using account tax settings.
 *
 * Assumptions (same as auto/history dividends via calcDividendTaxes; PDF import extracts
 * printed CDC amounts instead of computing):
 * - Gross = ratePerSecurity × noOfSecurities
 * - Zakat = 2.5% of gross when zakatOnDividends is enabled, else 0
 * - WHT = 15% of gross (filer) or 30% (non-filer)
 * - Net = Gross − Zakat − WHT (always derived)
 */
export function calcCdcManualDividendAmounts(
  ratePerSecurity: number,
  noOfSecurities: number,
  settings: TaxSettings
): { grossAmount: number; zakatDeducted: number; taxDeducted: number; netAmount: number } {
  const grossAmount = roundPkr(ratePerSecurity * noOfSecurities);
  const { wht, zakat, net } = calcDividendTaxes(grossAmount, settings);
  return {
    grossAmount,
    zakatDeducted: roundPkr(zakat),
    taxDeducted: roundPkr(wht),
    netAmount: roundPkr(net),
  };
}

/** Recompute Zakat/WHT/Net from Gross using the same % rates as calcDividendTaxes. */
export function recalcCdcAmountsFromGross(
  grossAmount: number,
  settings: TaxSettings
): { zakatDeducted: number; taxDeducted: number; netAmount: number } {
  const { wht, zakat, net } = calcDividendTaxes(grossAmount, settings);
  return {
    zakatDeducted: roundPkr(zakat),
    taxDeducted: roundPkr(wht),
    netAmount: roundPkr(net),
  };
}

export function deriveCdcNetAmount(gross: number, zakat: number, wht: number): number {
  return roundPkr(Math.max(0, gross - zakat - wht));
}

export function calcBrokerFee(tradeValue: number, feePct: number): number {
  return tradeValue * (feePct / 100);
}

export function calcCGT(realizedPL: number, settings: TaxSettings): number {
  if (realizedPL <= 0) return 0;
  return realizedPL * getCGTRate(settings);
}

export function defaultTaxSettings(): TaxSettings {
  return {
    taxFiler: false,
    brokerFeePct: 0.20,
    zakatOnDividends: false,
    cgtRateOverride: null,
  };
}

export function taxSettingsFromProfile(profile: {
  tax_filer: boolean;
  broker_fee_pct: number;
  zakat_on_dividends: boolean;
  cgt_rate_override: number | null;
}): TaxSettings {
  return {
    taxFiler: profile.tax_filer,
    brokerFeePct: profile.broker_fee_pct,
    zakatOnDividends: profile.zakat_on_dividends,
    cgtRateOverride: profile.cgt_rate_override,
  };
}
