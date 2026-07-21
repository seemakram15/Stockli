import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, TextInput, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, BriefcaseBusiness, ChevronRight, Eye, TrendingUp, TrendingDown } from "lucide-react-native";
import { useColors } from "@/lib/theme";
import { usePortfolios, useAllHoldings } from "@/hooks/usePortfolio";
import { usePrices } from "@/hooks/useMarket";
import { db, type Portfolio } from "@/lib/db";
import { formatPKR, formatPercent, plColor } from "@/lib/format";

function PortfolioCard({ portfolio, value, pl, plPct, holdingCount, onDelete, c }: {
  portfolio: Portfolio; value: number; pl: number; plPct: number; holdingCount: number;
  onDelete: () => void; c: ReturnType<typeof useColors>;
}) {
  const up = pl >= 0;
  return (
    <Pressable
      onPress={() => router.push(`/portfolio/${portfolio.id}`)}
      onLongPress={() => Alert.alert("Delete Portfolio", `Delete "${portfolio.name}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ])}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ backgroundColor: c.card, borderRadius: 18, borderWidth: 1, borderColor: c.border, padding: 18, gap: 14 }}>
        {/* Top row */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
            <BriefcaseBusiness size={18} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: c.fg }} numberOfLines={1}>{portfolio.name}</Text>
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{holdingCount} holdings</Text>
          </View>
          <ChevronRight size={16} color={c.muted} />
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: c.card2, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 10, color: c.muted, fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Value</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: c.fg }}>{formatPKR(value)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: up ? c.gainDim : c.lossDim, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontSize: 10, color: up ? c.gain : c.loss, fontWeight: "600", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>P/L</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: up ? c.gain : c.loss }}>
              {pl >= 0 ? "+" : ""}{formatPKR(pl)}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: "600", color: up ? c.gain : c.loss, marginTop: 2 }}>
              {plPct >= 0 ? "+" : ""}{formatPercent(plPct)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function PortfoliosScreen() {
  const c = useColors();
  const { data: portfolios = [], isLoading, mutate } = usePortfolios();
  const { data: allHoldings = [] } = useAllHoldings();
  const allSymbols = [...new Set(allHoldings.map((h) => h.symbol))];
  const { data: quotes = [] } = usePrices(allSymbols);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const quoteMap = new Map((quotes as any[]).map((q) => [q.symbol, q]));

  function portfolioMetrics(portfolioId: string) {
    const hlds = allHoldings.filter((h) => h.portfolio_id === portfolioId);
    let value = 0, cost = 0;
    for (const h of hlds) {
      const price = (quoteMap.get(h.symbol) as any)?.price ?? h.cost_basis;
      value += price * h.quantity; cost += h.cost_basis * h.quantity;
    }
    const pl = value - cost;
    return { value, pl, plPct: cost > 0 ? (pl / cost) * 100 : 0, holdingCount: hlds.length };
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try { await db.portfolios.create(newName.trim()); await mutate(); setNewName(""); setShowCreate(false); }
    catch { Alert.alert("Error", "Failed to create portfolio"); }
    finally { setCreating(false); }
  }

  async function handleDelete(id: string) {
    try { await db.portfolios.delete(id); await mutate(); }
    catch { Alert.alert("Error", "Failed to delete portfolio"); }
  }

  // Totals
  let grandValue = 0, grandCost = 0;
  for (const h of allHoldings) {
    const price = (quoteMap.get(h.symbol) as any)?.price ?? h.cost_basis;
    grandValue += price * h.quantity; grandCost += h.cost_basis * h.quantity;
  }
  const grandPL = grandValue - grandCost;
  const grandPct = grandCost > 0 ? (grandPL / grandCost) * 100 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: c.fg, letterSpacing: -0.8 }}>Portfolios</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => router.push("/watchlist" as never)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}
            >
              <Eye size={14} color={c.muted} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: c.muted }}>Watchlist</Text>
            </Pressable>
            <Pressable
              onPress={() => setShowCreate(true)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: c.primary }}
            >
              <Plus size={14} color="#04100d" />
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#04100d" }}>New</Text>
            </Pressable>
          </View>
        </View>

        {/* Grand total banner */}
        {portfolios.length > 0 && (
          <View style={{ marginHorizontal: 20, marginBottom: 20, borderRadius: 18, padding: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 12, color: c.muted, fontWeight: "600", marginBottom: 6 }}>Total Assets</Text>
            <Text style={{ fontSize: 32, fontWeight: "800", color: c.fg, letterSpacing: -1, marginBottom: 8 }}>{formatPKR(grandValue)}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: grandPL >= 0 ? c.gainDim : c.lossDim }}>
                {grandPL >= 0 ? <TrendingUp size={11} color={c.gain} /> : <TrendingDown size={11} color={c.loss} />}
                <Text style={{ fontSize: 12, fontWeight: "700", color: plColor(grandPL) }}>{grandPL >= 0 ? "+" : ""}{formatPKR(grandPL)}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: plColor(grandPct) }}>{grandPct >= 0 ? "+" : ""}{formatPercent(grandPct)}</Text>
            </View>
          </View>
        )}

        {/* List */}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
          ) : portfolios.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 56, gap: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                <BriefcaseBusiness size={28} color={c.muted} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700", color: c.fg }}>No portfolios yet</Text>
              <Text style={{ fontSize: 14, color: c.muted, textAlign: "center", paddingHorizontal: 32 }}>
                Create a portfolio to start tracking your PSX investments
              </Text>
              <Pressable onPress={() => setShowCreate(true)} style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: c.primary }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#04100d" }}>Create Portfolio</Text>
              </Pressable>
            </View>
          ) : (
            portfolios.map((p) => {
              const m = portfolioMetrics(p.id);
              return <PortfolioCard key={p.id} portfolio={p} {...m} onDelete={() => handleDelete(p.id)} c={c} />;
            })
          )}
        </View>
      </ScrollView>

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setShowCreate(false)} />
        <View style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: c.border, padding: 24, paddingBottom: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: c.fg, marginBottom: 16 }}>New Portfolio</Text>
          <TextInput
            style={{ borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card2, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: c.fg, marginBottom: 16 }}
            placeholder="Portfolio name"
            placeholderTextColor={c.muted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <Pressable
            onPress={handleCreate}
            disabled={creating || !newName.trim()}
            style={{ borderRadius: 14, backgroundColor: c.primary, paddingVertical: 15, alignItems: "center" }}
          >
            {creating ? <ActivityIndicator size="small" color="#04100d" /> : (
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#04100d" }}>Create</Text>
            )}
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
