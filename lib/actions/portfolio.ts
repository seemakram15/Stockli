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
