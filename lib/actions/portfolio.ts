"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSampleMode } from "@/lib/auth/roles";
import { normalizeSymbol } from "@/lib/security/validation";
import { weightedAvgPrice } from "@/lib/services/metrics";
import type { Holding } from "@/lib/types";

export interface ActionState {
  error?: string;
  message?: string;
  ok?: boolean;
  portfolioId?: string;
}

const DEMO_BLOCK: ActionState = {
  error: "Sign in to save changes — you're viewing sample data.",
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

async function requireOwnedPortfolio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  portfolioId: string
) {
  const { data, error } = await supabase
    .from("portfolios")
    .select("id")
    .eq("id", portfolioId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Portfolio not found.");
  return data.id;
}

// ── Portfolios ────────────────────────────────────────────────

const portfolioSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(280).optional(),
});

export async function createPortfolio(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (await isSampleMode()) return DEMO_BLOCK;
  const parsed = portfolioSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { supabase, user } = await requireUser();
    const { data: created, error } = await supabase
      .from("portfolios")
      .insert({
        user_id: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    revalidatePath("/portfolios");
    revalidatePath("/dashboard");
    return { ok: true, portfolioId: created.id, message: "Portfolio created." };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function updatePortfolio(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (await isSampleMode()) return DEMO_BLOCK;
  const id = String(formData.get("id") ?? "");
  const parsed = portfolioSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!id || !parsed.success)
    return { error: parsed.success ? "Missing id" : parsed.error.issues[0].message };

  try {
    const { supabase, user } = await requireUser();
    await requireOwnedPortfolio(supabase, user.id, id);
    const { error } = await supabase
      .from("portfolios")
      .update({ name: parsed.data.name, description: parsed.data.description ?? null })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/portfolios");
    revalidatePath(`/portfolios/${id}`);
    revalidatePath("/dashboard");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deletePortfolio(formData: FormData): Promise<void> {
  if (await isSampleMode()) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const { supabase, user } = await requireUser();
  await requireOwnedPortfolio(supabase, user.id, id);
  await supabase.from("portfolios").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/portfolios");
  revalidatePath("/dashboard");
}

// ── Holdings + transactions ───────────────────────────────────

const tradeSchema = z.object({
  portfolioId: z.string().uuid(),
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((value, ctx) => {
      const symbol = normalizeSymbol(value);
      if (!symbol) {
        ctx.addIssue({ code: "custom", message: "Invalid symbol" });
        return z.NEVER;
      }
      return symbol;
    }),
  quantity: z.coerce.number().positive("Quantity must be > 0"),
  price: z.coerce.number().nonnegative("Price must be ≥ 0"),
  fees: z.coerce.number().nonnegative().default(0),
  date: z.string().optional(),
  note: z.string().max(280).optional(),
});

/** BUY: upsert the holding with a weighted-average cost + log a transaction. */
export async function addHolding(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (await isSampleMode()) return DEMO_BLOCK;
  const parsed = tradeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { portfolioId, symbol, quantity, price, fees, date, note } = parsed.data;
  const sym = symbol;
  const when = date ? new Date(date).toISOString() : new Date().toISOString();

  try {
    const { supabase, user } = await requireUser();
    await requireOwnedPortfolio(supabase, user.id, portfolioId);

    // Ensure the ticker exists (FK) — insert a minimal row if missing.
    await supabase.from("tickers").upsert({ symbol: sym }, { onConflict: "symbol" });

    const { data: existing } = await supabase
      .from("holdings")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .eq("symbol", sym)
      .maybeSingle();

    const ex = existing as Holding | null;
    const newQty = (ex?.quantity ?? 0) + quantity;
    const newAvg = weightedAvgPrice(ex?.quantity ?? 0, ex?.avg_buy_price ?? 0, quantity, price);

    const { error: upErr } = await supabase
      .from("holdings")
      .upsert(
        { portfolio_id: portfolioId, symbol: sym, quantity: newQty, avg_buy_price: newAvg },
        { onConflict: "portfolio_id,symbol" }
      );
    if (upErr) return { error: upErr.message };

    await supabase.from("transactions").insert({
      portfolio_id: portfolioId,
      symbol: sym,
      type: "BUY",
      quantity,
      price,
      fees,
      note: note ?? null,
      transacted_at: when,
    });

    revalidatePath(`/portfolios/${portfolioId}`);
    revalidatePath("/portfolios");
    revalidatePath("/dashboard");
    return { ok: true, message: `Added ${quantity} ${sym}.` };
  } catch (e) {
    return { error: String(e) };
  }
}

/** SELL: reduce the position (removing it at zero) + log a SELL transaction. */
export async function sellHolding(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  if (await isSampleMode()) return DEMO_BLOCK;
  const parsed = tradeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { portfolioId, symbol, quantity, price, fees, date, note } = parsed.data;
  const sym = symbol;
  const when = date ? new Date(date).toISOString() : new Date().toISOString();

  try {
    const { supabase, user } = await requireUser();
    await requireOwnedPortfolio(supabase, user.id, portfolioId);
    const { data: existing } = await supabase
      .from("holdings")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .eq("symbol", sym)
      .maybeSingle();
    const ex = existing as Holding | null;
    if (!ex) return { error: `No ${sym} position to sell.` };
    if (quantity > ex.quantity) return { error: `You only hold ${ex.quantity} ${sym}.` };

    const remaining = ex.quantity - quantity;
    if (remaining <= 0) {
      await supabase.from("holdings").delete().eq("id", ex.id);
    } else {
      await supabase.from("holdings").update({ quantity: remaining }).eq("id", ex.id);
    }

    await supabase.from("transactions").insert({
      portfolio_id: portfolioId,
      symbol: sym,
      type: "SELL",
      quantity,
      price,
      fees,
      note: note ?? null,
      transacted_at: when,
    });

    revalidatePath(`/portfolios/${portfolioId}`);
    revalidatePath("/portfolios");
    revalidatePath("/dashboard");
    return { ok: true, message: `Sold ${quantity} ${sym}.` };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function removeHolding(formData: FormData): Promise<ActionState> {
  if (await isSampleMode()) return DEMO_BLOCK;
  const holdingId = String(formData.get("holdingId") ?? "");
  const portfolioId = String(formData.get("portfolioId") ?? "");
  if (!holdingId || !portfolioId) return { error: "Missing parameters." };
  try {
    const { supabase, user } = await requireUser();
    await requireOwnedPortfolio(supabase, user.id, portfolioId);
    await supabase.from("holdings").delete().eq("id", holdingId);
    revalidatePath(`/portfolios/${portfolioId}`);
    revalidatePath("/portfolios");
    revalidatePath("/dashboard");
    return { ok: true, portfolioId };
  } catch (e) {
    return { error: String(e) };
  }
}

export interface StatementImportTradeInput {
  side: "BUY" | "SELL";
  symbol: string;
  quantity: number;
  price: number;
  /** Broker fees + tax combined into the fees column. */
  fees: number;
  date: string;
  note?: string;
}

export interface StatementImportResult {
  ok?: boolean;
  error?: string;
  message?: string;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Import approved statement trades chronologically.
 * Holdings avg cost / qty and realized P/L history update through the same
 * BUY/SELL paths used by the manual trade dialog.
 */
export async function importStatementTrades(
  portfolioId: string,
  trades: StatementImportTradeInput[]
): Promise<StatementImportResult> {
  if (await isSampleMode()) {
    return { error: DEMO_BLOCK.error, imported: 0, skipped: 0, errors: [DEMO_BLOCK.error!] };
  }
  if (!portfolioId || !Array.isArray(trades) || !trades.length) {
    return { error: "No trades to import.", imported: 0, skipped: 0, errors: [] };
  }

  const rowSchema = z.object({
    side: z.enum(["BUY", "SELL"]),
    symbol: z
      .string()
      .min(1)
      .max(20)
      .transform((value, ctx) => {
        const symbol = normalizeSymbol(value);
        if (!symbol) {
          ctx.addIssue({ code: "custom", message: "Invalid symbol" });
          return z.NEVER;
        }
        return symbol;
      }),
    quantity: z.number().positive(),
    price: z.number().nonnegative(),
    fees: z.number().nonnegative().default(0),
    date: z.string().min(8, "Date is required"),
    note: z.string().max(280).optional(),
  });

  const parsedRows: Array<z.infer<typeof rowSchema> & { side: "BUY" | "SELL" }> = [];
  const errors: string[] = [];

  for (let i = 0; i < trades.length; i++) {
    const parsed = rowSchema.safeParse(trades[i]);
    if (!parsed.success) {
      errors.push(`Row ${i + 1}: ${parsed.error.issues[0]?.message ?? "Invalid trade"}`);
      continue;
    }
    const when = new Date(parsed.data.date);
    if (Number.isNaN(when.getTime())) {
      errors.push(`Row ${i + 1} (${parsed.data.symbol}): invalid date`);
      continue;
    }
    parsedRows.push(parsed.data);
  }

  if (!parsedRows.length) {
    return { error: "No valid trades to import.", imported: 0, skipped: trades.length, errors };
  }

  // Chronological apply so avg cost / sell qty stay consistent
  parsedRows.sort((a, b) => {
    const da = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (da !== 0) return da;
    if (a.side !== b.side) return a.side === "BUY" ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  });

  try {
    const { supabase, user } = await requireUser();
    await requireOwnedPortfolio(supabase, user.id, portfolioId);

    // Always insert transaction rows. Holdings are best-effort updated to match
    // schema (qty / avg cost) but never block import when sell qty exceeds position.
    let imported = 0;
    for (const row of parsedRows) {
      const sym = row.symbol;
      const fees = row.fees ?? 0;
      const when = new Date(row.date).toISOString();
      const note = row.note?.trim() || null;

      await supabase.from("tickers").upsert({ symbol: sym }, { onConflict: "symbol" });

      const { data: existing } = await supabase
        .from("holdings")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .eq("symbol", sym)
        .maybeSingle();
      const ex = existing as Holding | null;

      if (row.side === "BUY") {
        const newQty = (ex?.quantity ?? 0) + row.quantity;
        const newAvg = weightedAvgPrice(ex?.quantity ?? 0, ex?.avg_buy_price ?? 0, row.quantity, row.price);
        const { error: upErr } = await supabase.from("holdings").upsert(
          { portfolio_id: portfolioId, symbol: sym, quantity: newQty, avg_buy_price: newAvg },
          { onConflict: "portfolio_id,symbol" }
        );
        if (upErr) {
          errors.push(`BUY ${sym} holding: ${upErr.message}`);
        }
        const { error: txErr } = await supabase.from("transactions").insert({
          portfolio_id: portfolioId,
          symbol: sym,
          type: "BUY",
          quantity: row.quantity,
          price: row.price,
          fees,
          note,
          transacted_at: when,
        });
        if (txErr) {
          errors.push(`BUY ${sym} tx: ${txErr.message}`);
          continue;
        }
        imported++;
      } else {
        // SELL: always insert the transaction. Adjust holdings if present.
        if (ex) {
          const remaining = Math.max(0, ex.quantity - row.quantity);
          if (remaining <= 0) {
            await supabase.from("holdings").delete().eq("id", ex.id);
          } else {
            await supabase.from("holdings").update({ quantity: remaining }).eq("id", ex.id);
          }
        }
        const { error: txErr } = await supabase.from("transactions").insert({
          portfolio_id: portfolioId,
          symbol: sym,
          type: "SELL",
          quantity: row.quantity,
          price: row.price,
          fees,
          note,
          transacted_at: when,
        });
        if (txErr) {
          errors.push(`SELL ${sym} tx: ${txErr.message}`);
          continue;
        }
        imported++;
      }
    }

    revalidatePath(`/portfolios/${portfolioId}`);
    revalidatePath("/portfolios");
    revalidatePath("/dashboard");

    return {
      ok: imported > 0,
      imported,
      skipped: parsedRows.length - imported,
      errors,
      message:
        imported > 0
          ? `Imported ${imported} trade${imported === 1 ? "" : "s"}.`
          : undefined,
      error: imported === 0 ? errors[0] ?? "Nothing imported." : undefined,
    };
  } catch (e) {
    return {
      error: String(e),
      imported: 0,
      skipped: parsedRows.length,
      errors: [String(e)],
    };
  }
}

