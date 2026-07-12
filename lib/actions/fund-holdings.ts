"use server";

import { getRequestUser } from "@/lib/auth/current-user";
import {
  getFundPeriods,
  getPeriodHoldings,
  savePeriodHoldings,
  deletePeriodHoldings,
  getAllPublishedHoldings,
  getPublishedPeriods,
  getPublishedFundHoldings,
} from "@/lib/services/fund-holdings";
import { getAmcForFund } from "@/lib/constants/pakistan-funds";
import type {
  FundPeriodStatus,
  FundHolding,
  SaveHoldingInput,
} from "@/lib/types/fund-holdings";

export async function loadFundPeriods(
  fundName: string
): Promise<{ periods: FundPeriodStatus[] }> {
  const periods = await getFundPeriods(fundName);
  return { periods };
}

export async function loadPeriodHoldings(
  fundName: string,
  year: number,
  month: number
): Promise<{ holdings: FundHolding[] }> {
  const holdings = await getPeriodHoldings(fundName, year, month);
  return { holdings };
}

export async function saveHoldings(
  fundName: string,
  year: number,
  month: number,
  holdings: SaveHoldingInput[],
  status: "draft" | "published"
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await getRequestUser();
    if (!user) return { ok: false, error: "Not authenticated" };
    const amc = getAmcForFund(fundName);
    await savePeriodHoldings(fundName, amc, year, month, holdings, status, user.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function deleteHoldings(
  fundName: string,
  year: number,
  month: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deletePeriodHoldings(fundName, year, month);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function loadAllPublished(opts: {
  amc?: string;
  year?: number;
  month?: number;
}): Promise<{ groups: { amc: string; fundName: string; year: number; month: number; holdings: FundHolding[] }[] }> {
  try {
    const groups = await getAllPublishedHoldings(opts);
    return { groups };
  } catch {
    return { groups: [] };
  }
}

export async function loadPublishedPeriods(
  fundName: string
): Promise<{ periods: { year: number; month: number }[] }> {
  const periods = await getPublishedPeriods(fundName);
  return { periods };
}

export async function loadPublishedFundHoldings(
  fundName: string,
  year: number,
  month: number
): Promise<{ holdings: FundHolding[] }> {
  const holdings = await getPublishedFundHoldings(fundName, year, month);
  return { holdings };
}
