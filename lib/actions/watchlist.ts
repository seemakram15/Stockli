"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { normalizeSymbol } from "@/lib/security/validation";

export interface ToggleState {
  watching?: boolean;
  error?: string;
}

/** Ensure the user has a watchlist; return its id. */
async function ensureWatchlist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from("watchlists").select("id").limit(1).maybeSingle();
  if (data?.id) return data.id;
  const { data: created } = await supabase
    .from("watchlists")
    .insert({ user_id: userId, name: "Watchlist" })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function toggleWatchlist(
  _prev: ToggleState,
  formData: FormData
): Promise<ToggleState> {
  const symbol = normalizeSymbol(formData.get("symbol"));
  const watching = String(formData.get("watching") ?? "") === "true";
  if (isDemoMode)
    return { error: "Demo mode — add Supabase keys to use watchlists." };
  if (!symbol) return { error: "Invalid symbol" };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const wlId = await ensureWatchlist(supabase, user.id);
    if (!wlId) return { error: "Could not access watchlist" };

    if (watching) {
      await supabase
        .from("watchlist_items")
        .delete()
        .eq("watchlist_id", wlId)
        .eq("symbol", symbol);
    } else {
      await supabase
        .from("watchlist_items")
        .upsert({ watchlist_id: wlId, symbol }, { onConflict: "watchlist_id,symbol" });
    }
    revalidatePath("/watchlist");
    revalidatePath(`/stock/${symbol}`);
    return { watching: !watching };
  } catch (e) {
    return { error: String(e) };
  }
}

export async function removeFromWatchlist(formData: FormData): Promise<void> {
  if (isDemoMode) return;
  const symbol = normalizeSymbol(formData.get("symbol"));
  if (!symbol) return;
  const supabase = await createClient();
  const { data: lists } = await supabase.from("watchlists").select("id");
  const ids = (lists as { id: string }[] | null)?.map((l) => l.id) ?? [];
  if (ids.length === 0) return;
  await supabase.from("watchlist_items").delete().in("watchlist_id", ids).eq("symbol", symbol);
  revalidatePath("/watchlist");
}
