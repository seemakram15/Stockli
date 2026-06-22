"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol } from "@/lib/security/validation";

export interface AlertActionState {
  ok?: boolean;
  error?: string;
  message?: string;
}

const alertSchema = z.object({
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
  condition: z.enum(["ABOVE", "BELOW"]),
  target_price: z.coerce.number().positive("Target must be > 0"),
});

export async function createAlert(
  _prev: AlertActionState,
  formData: FormData
): Promise<AlertActionState> {
  if (isDemoMode)
    return { error: "Demo mode — add Supabase keys to create alerts." };
  const parsed = alertSchema.safeParse({
    symbol: formData.get("symbol"),
    condition: formData.get("condition"),
    target_price: formData.get("target_price"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      symbol: parsed.data.symbol,
      condition: parsed.data.condition,
      target_price: parsed.data.target_price,
    });
    if (error) return { error: error.message };
    revalidatePath("/alerts");
    return { ok: true, message: "Alert created." };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function deleteAlert(formData: FormData): Promise<void> {
  if (isDemoMode) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("alerts").delete().eq("id", id);
  revalidatePath("/alerts");
}

export async function toggleAlert(formData: FormData): Promise<void> {
  if (isDemoMode) return;
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("alerts").update({ is_active: !active }).eq("id", id);
  revalidatePath("/alerts");
}
