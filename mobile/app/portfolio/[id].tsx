import { useState } from "react";
import {
  View, ScrollView, TouchableOpacity, Alert, TextInput, Modal,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Plus, ChevronRight } from "lucide-react-native";
import { colors, useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { usePortfolios, useHoldings, useTransactions } from "@/hooks/usePortfolio";
import { usePrices } from "@/hooks/useMarket";
import { db } from "@/lib/db";
import { formatPKR, formatPercent, plColor } from "@/lib/format";

interface AddTradeForm {
  symbol: string;
  type: "BUY" | "SELL";
  quantity: string;
  price: string;
  date: string;
}

function HoldingRow({
  symbol,
  quantity,
  costBasis,
  price,
}: {
  symbol: string;
  quantity: number;
  costBasis: number;
  price: number | null;
}) {
  const current = price ?? costBasis;
  const value = current * quantity;
  const cost = costBasis * quantity;
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  return (
    <TouchableOpacity
      className="flex-row items-center justify-between py-3 border-b border-border active:opacity-70"
      onPress={() => router.push(`/stock/${symbol}`)}
    >
      <View className="flex-1">
        <ThemedText variant="body">{symbol}</ThemedText>
        <ThemedText variant="caption" className="text-muted">
          {quantity.toLocaleString()} shares · avg {formatPKR(costBasis)}
        </ThemedText>
      </View>
      <View className="items-end">
        <ThemedText variant="body" className="text-fg">{formatPKR(value)}</ThemedText>
        <ThemedText variant="caption" style={{ color: plColor(pl) }}>
          {pl >= 0 ? "+" : ""}{formatPKR(pl)} ({formatPercent(plPct)})
        </ThemedText>
      </View>
      <ChevronRight size={14} color={colors.muted} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

export default function PortfolioDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: portfolios = [] } = usePortfolios();
  const { data: holdings = [], isLoading, mutate: mutateHoldings } = useHoldings(id);
  const { data: transactions = [], mutate: mutateTx } = useTransactions(id);

  const symbols = [...new Set(holdings.map((h) => h.symbol))];
  const { data: quotes = [] } = usePrices(symbols);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<AddTradeForm>({
    symbol: "", type: "BUY", quantity: "", price: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  const portfolio = portfolios.find((p) => p.id === id);

  const quoteMap = new Map(
    (quotes as { symbol: string; price: number }[]).map((q) => [q.symbol, q])
  );

  let totalValue = 0, totalCost = 0;
  for (const h of holdings) {
    const price = quoteMap.get(h.symbol)?.price ?? h.cost_basis;
    totalValue += price * h.quantity;
    totalCost += h.cost_basis * h.quantity;
  }
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const { data: { user } = {} } = { data: { user: null as { id: string } | null } };

  async function handleAddTrade() {
    const sym = form.symbol.trim().toUpperCase();
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.price);
    if (!sym || isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
      Alert.alert("Validation", "Enter a valid symbol, quantity, and price");
      return;
    }
    setSaving(true);
    try {
      const { data: { user: u } } = await (await import("@/lib/supabase")).supabase.auth.getUser();
      if (!u) throw new Error("Not signed in");
      await db.transactions.add({
        portfolio_id: id,
        user_id: u.id,
        symbol: sym,
        type: form.type,
        quantity: qty,
        price,
        commission: 0,
        date: form.date,
        notes: null,
      });
      await mutateHoldings();
      await mutateTx();
      setShowAdd(false);
      setForm({ symbol: "", type: "BUY", quantity: "", price: "", date: new Date().toISOString().split("T")[0] });
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!portfolio) {
    return (
      <SafeAreaView className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator size="large" color={c.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView className="flex-1" contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 pt-2 pb-4">
          <TouchableOpacity onPress={() => router.back()} className="size-9 items-center justify-center">
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <ThemedText variant="title" numberOfLines={1}>{portfolio.name}</ThemedText>
          </View>
          <TouchableOpacity
            className="flex-row items-center gap-1.5 rounded-xl bg-accent px-3 py-2"
            onPress={() => setShowAdd(true)}
          >
            <Plus size={14} color="#fff" />
            <ThemedText variant="label" style={{ color: "#fff" }}>Trade</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Summary card */}
        <View className="px-4 mb-4">
          <Card className="gap-3">
            <View className="flex-row justify-between">
              <View>
                <ThemedText variant="caption" className="text-muted mb-0.5">Market Value</ThemedText>
                <ThemedText variant="title" className="text-fg">{formatPKR(totalValue)}</ThemedText>
              </View>
              <View className="items-end">
                <ThemedText variant="caption" className="text-muted mb-0.5">Total P/L</ThemedText>
                <ThemedText variant="subhead" style={{ color: plColor(totalPL) }}>
                  {totalPL >= 0 ? "+" : ""}{formatPKR(totalPL)}
                </ThemedText>
                <ThemedText variant="caption" style={{ color: plColor(totalPLPct) }}>
                  {formatPercent(totalPLPct)}
                </ThemedText>
              </View>
            </View>
            <View className="flex-row gap-4 pt-1 border-t border-border">
              <View>
                <ThemedText variant="caption" className="text-muted">Cost Basis</ThemedText>
                <ThemedText variant="body" className="text-fg">{formatPKR(totalCost)}</ThemedText>
              </View>
              <View>
                <ThemedText variant="caption" className="text-muted">Holdings</ThemedText>
                <ThemedText variant="body" className="text-fg">{holdings.length}</ThemedText>
              </View>
              <View>
                <ThemedText variant="caption" className="text-muted">Trades</ThemedText>
                <ThemedText variant="body" className="text-fg">{transactions.length}</ThemedText>
              </View>
            </View>
          </Card>
        </View>

        {/* Holdings list */}
        <View className="px-4">
          <ThemedText variant="label" className="mb-3">Holdings</ThemedText>
          {isLoading ? (
            <ActivityIndicator size="small" color={c.primary} />
          ) : holdings.length === 0 ? (
            <Card className="items-center py-8 gap-2">
              <ThemedText variant="body" className="text-muted">No holdings yet</ThemedText>
              <ThemedText variant="caption" className="text-muted text-center">
                Tap Trade to record your first buy
              </ThemedText>
            </Card>
          ) : (
            <Card className="px-0 pt-0">
              {holdings.map((h) => (
                <HoldingRow
                  key={h.id}
                  symbol={h.symbol}
                  quantity={h.quantity}
                  costBasis={h.cost_basis}
                  price={quoteMap.get(h.symbol)?.price ?? null}
                />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Add Trade Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
          <TouchableOpacity className="flex-1 bg-black/60" onPress={() => setShowAdd(false)} />
          <View className="bg-surface border-t border-border px-4 pt-4 pb-10 gap-4">
            <ThemedText variant="subhead">Record Trade</ThemedText>

            {/* Buy/Sell toggle */}
            <View className="flex-row gap-2">
              {(["BUY", "SELL"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  className={`flex-1 py-2.5 rounded-xl items-center border ${
                    form.type === t ? "bg-accent border-accent" : "border-border"
                  }`}
                  onPress={() => setForm((f) => ({ ...f, type: t }))}
                >
                  <ThemedText
                    variant="label"
                    style={{ color: form.type === t ? "#fff" : colors.muted }}
                  >
                    {t}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            {[
              { key: "symbol", label: "Symbol (e.g. OGDC)", upper: true },
              { key: "quantity", label: "Quantity", numeric: true },
              { key: "price", label: "Price (PKR)", numeric: true },
              { key: "date", label: "Date (YYYY-MM-DD)" },
            ].map(({ key, label, upper, numeric }) => (
              <TextInput
                key={key}
                className="rounded-xl border border-border bg-canvas px-4 py-3 text-fg text-[16px]"
                placeholder={label}
                placeholderTextColor={colors.muted}
                value={form[key as keyof AddTradeForm]}
                onChangeText={(v) =>
                  setForm((f) => ({ ...f, [key]: upper ? v.toUpperCase() : v }))
                }
                keyboardType={numeric ? "decimal-pad" : "default"}
                autoCapitalize={upper ? "characters" : "none"}
              />
            ))}

            <TouchableOpacity
              className="rounded-xl bg-accent py-3 items-center"
              onPress={handleAddTrade}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText variant="label" style={{ color: "#fff" }}>
                  Save {form.type}
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
