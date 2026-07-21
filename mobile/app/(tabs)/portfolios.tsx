import { useState } from "react";
import { View, ScrollView, Pressable, Alert, TextInput, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, BriefcaseBusiness, ChevronRight, Eye } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { usePortfolios, useAllHoldings } from "@/hooks/usePortfolio";
import { usePrices } from "@/hooks/useMarket";
import { db, type Portfolio } from "@/lib/db";
import { formatPKR, formatPercent, plColor } from "@/lib/format";

function PortfolioCard({
  portfolio,
  value,
  pl,
  plPct,
  holdingCount,
  onDelete,
}: {
  portfolio: Portfolio;
  value: number;
  pl: number;
  plPct: number;
  holdingCount: number;
  onDelete: () => void;
}) {
  return (
    <Pressable
      className="active:opacity-80"
      onPress={() => router.push(`/portfolio/${portfolio.id}`)}
      onLongPress={() => {
        Alert.alert("Delete Portfolio", `Delete "${portfolio.name}"?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ]);
      }}
    >
      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2 flex-1">
            <View className="size-8 rounded-lg bg-accent/20 items-center justify-center">
              <BriefcaseBusiness size={16} color={colors.accent} />
            </View>
            <ThemedText variant="subhead" className="flex-1" numberOfLines={1}>
              {portfolio.name}
            </ThemedText>
          </View>
          <ChevronRight size={16} color={colors.muted} />
        </View>

        <View className="flex-row justify-between pt-1">
          <View>
            <ThemedText variant="caption" className="text-muted mb-0.5">Market Value</ThemedText>
            <ThemedText variant="subhead" style={{ color: "#e2e2f0" }}>
              {formatPKR(value)}
            </ThemedText>
          </View>
          <View className="items-end">
            <ThemedText variant="caption" className="text-muted mb-0.5">Total P/L</ThemedText>
            <ThemedText variant="subhead" style={{ color: plColor(pl) }}>
              {pl >= 0 ? "+" : ""}{formatPKR(pl)}
            </ThemedText>
            <ThemedText variant="caption" style={{ color: plColor(plPct) }}>
              {plPct >= 0 ? "+" : ""}{formatPercent(plPct)}
            </ThemedText>
          </View>
          <View className="items-end">
            <ThemedText variant="caption" className="text-muted mb-0.5">Holdings</ThemedText>
            <ThemedText variant="subhead" style={{ color: "#e2e2f0" }}>
              {holdingCount}
            </ThemedText>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function PortfoliosScreen() {
  const { data: portfolios = [], isLoading, mutate } = usePortfolios();
  const { data: allHoldings = [] } = useAllHoldings();
  const allSymbols = [...new Set(allHoldings.map((h) => h.symbol))];
  const { data: quotes = [] } = usePrices(allSymbols);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const quoteMap = new Map(
    (quotes as { symbol: string; price: number }[]).map((q) => [q.symbol, q])
  );

  function portfolioMetrics(portfolioId: string) {
    const holdings = allHoldings.filter((h) => h.portfolio_id === portfolioId);
    let value = 0;
    let cost = 0;
    for (const h of holdings) {
      const q = quoteMap.get(h.symbol);
      const price = q?.price ?? h.cost_basis;
      value += price * h.quantity;
      cost += h.cost_basis * h.quantity;
    }
    const pl = value - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    return { value, pl, plPct, holdingCount: holdings.length };
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await db.portfolios.create(newName.trim());
      await mutate();
      setNewName("");
      setShowCreate(false);
    } catch {
      Alert.alert("Error", "Failed to create portfolio");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await db.portfolios.delete(id);
      await mutate();
    } catch {
      Alert.alert("Error", "Failed to delete portfolio");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between py-2">
          <ThemedText variant="title">Portfolios</ThemedText>
          <View className="flex-row gap-2">
            <Pressable
              className="flex-row items-center gap-1.5 rounded-xl border border-border px-3 py-2"
              onPress={() => router.push("/watchlist" as never)}
            >
              <Eye size={14} color={colors.muted} />
              <ThemedText variant="label" className="text-muted">Watchlist</ThemedText>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-1.5 rounded-xl bg-accent px-3 py-2"
              onPress={() => setShowCreate(true)}
            >
              <Plus size={14} color="#fff" />
              <ThemedText variant="label" style={{ color: "#fff" }}>New</ThemedText>
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : portfolios.length === 0 ? (
          <Card className="items-center py-12 gap-3">
            <BriefcaseBusiness size={40} color={colors.muted} />
            <ThemedText variant="subhead" className="text-muted">No portfolios yet</ThemedText>
            <ThemedText variant="caption" className="text-muted text-center px-4">
              Create a portfolio to start tracking your investments
            </ThemedText>
            <Pressable
              className="mt-2 rounded-xl bg-accent px-6 py-3"
              onPress={() => setShowCreate(true)}
            >
              <ThemedText variant="label" style={{ color: "#fff" }}>Create Portfolio</ThemedText>
            </Pressable>
          </Card>
        ) : (
          portfolios.map((p) => {
            const m = portfolioMetrics(p.id);
            return (
              <PortfolioCard
                key={p.id}
                portfolio={p}
                {...m}
                onDelete={() => handleDelete(p.id)}
              />
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={showCreate}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreate(false)}
      >
        <Pressable className="flex-1 bg-black/60" onPress={() => setShowCreate(false)} />
        <View className="bg-surface border-t border-border px-4 pt-4 pb-10">
          <ThemedText variant="subhead" className="mb-4">New Portfolio</ThemedText>
          <TextInput
            className="rounded-xl border border-border bg-[#0f0f13] px-4 py-3 text-[#e2e2f0] text-[16px] mb-4"
            placeholder="Portfolio name"
            placeholderTextColor={colors.muted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <Pressable
            className="rounded-xl bg-accent py-3 items-center"
            onPress={handleCreate}
            disabled={creating || !newName.trim()}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText variant="label" style={{ color: "#fff" }}>Create</ThemedText>
            )}
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
