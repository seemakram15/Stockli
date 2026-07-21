import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TrendingUp, TrendingDown, Search, Bell } from "lucide-react-native";
import { useColors } from "@/lib/theme";
import { usePublicMarket, usePrices } from "@/hooks/useMarket";
import { usePortfolios, useAllHoldings } from "@/hooks/usePortfolio";
import { formatPKR, formatPercent, plColor } from "@/lib/format";
import { useSession } from "@/hooks/useSession";

interface IndexCard { symbol: string; label: string; current: number; changePct: number }
interface Mover { symbol: string; company_name: string | null; changePct: number }

function IndexCard({ label, value, pct, c }: { label: string; value: number; pct: number; c: ReturnType<typeof useColors> }) {
  const up = pct >= 0;
  return (
    <View style={{
      width: 140, borderRadius: 16, padding: 14, marginRight: 10,
      backgroundColor: c.card,
      borderWidth: 1, borderColor: c.border,
    }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: c.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 20, fontWeight: "800", color: c.fg, letterSpacing: -0.5, marginBottom: 4 }}>
        {value.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
      </Text>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, alignSelf: "flex-start",
        backgroundColor: up ? c.gainDim : c.lossDim,
      }}>
        {up ? <TrendingUp size={10} color={c.gain} /> : <TrendingDown size={10} color={c.loss} />}
        <Text style={{ fontSize: 11, fontWeight: "700", color: up ? c.gain : c.loss }}>
          {up ? "+" : ""}{pct.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function MoverRow({ item, c, rank }: { item: Mover; c: ReturnType<typeof useColors>; rank: number }) {
  const up = item.changePct >= 0;
  return (
    <Pressable
      onPress={() => router.push(`/stock/${item.symbol}`)}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center",
        paddingVertical: 10, opacity: pressed ? 0.7 : 1,
        gap: 10,
      })}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: c.muted, width: 16 }}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: c.fg }}>{item.symbol}</Text>
        {item.company_name
          ? <Text style={{ fontSize: 11, color: c.muted, marginTop: 1 }} numberOfLines={1}>{item.company_name}</Text>
          : null}
      </View>
      <View style={{
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
        backgroundColor: up ? c.gainDim : c.lossDim,
      }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: up ? c.gain : c.loss }}>
          {up ? "+" : ""}{formatPercent(item.changePct)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const c = useColors();
  const { user } = useSession();
  const { data: marketData, isLoading: mktLoading, mutate: refreshMkt } = usePublicMarket();
  const { data: portfolios = [] } = usePortfolios();
  const { data: holdings = [] } = useAllHoldings();
  const allSymbols = [...new Set(holdings.map((h) => h.symbol))];
  const { data: quotes = [] } = usePrices(allSymbols);

  const market = (marketData as any)?.data;
  const indices: IndexCard[] = (market?.indices ?? [])
    .filter((i: any) => ["KSE100", "KSE30", "KMI30"].includes(i.symbol))
    .map((i: any) => ({ ...i, label: i.symbol === "KSE100" ? "KSE 100" : i.symbol === "KSE30" ? "KSE 30" : "KMI 30" }));

  const rows: Mover[] = market?.rows ?? [];
  const gainers = [...rows].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...rows].sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  const quoteMap = new Map((quotes as any[]).map((q) => [q.symbol, q]));
  let totalValue = 0, totalCost = 0;
  for (const h of holdings) {
    const q = quoteMap.get(h.symbol);
    const price = (q as any)?.price ?? h.cost_basis;
    totalValue += price * h.quantity;
    totalCost += h.cost_basis * h.quantity;
  }
  const totalPL = totalValue - totalCost;
  const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "Investor";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={mktLoading && !marketData} onRefresh={refreshMkt} tintColor={c.primary} />}
      >
        {/* ── Header ─────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Image source={require("../../assets/images/icon.png")} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <View>
              <Text style={{ fontSize: 11, color: c.muted, fontWeight: "600" }}>{greeting}</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: c.fg, letterSpacing: -0.3 }}>{displayName}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => router.push("/search")} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <Search size={16} color={c.muted} />
            </Pressable>
            <Pressable onPress={() => router.push("/alerts")} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} color={c.muted} />
            </Pressable>
          </View>
        </View>

        {/* ── Portfolio hero ──────────────────────── */}
        {portfolios.length > 0 && (
          <Pressable onPress={() => router.push("/(tabs)/portfolios")} style={{ marginHorizontal: 20, marginTop: 12, marginBottom: 4 }}>
            <View style={{
              borderRadius: 20, padding: 22,
              backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
            }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: c.muted, marginBottom: 6 }}>Total Portfolio Value</Text>
              <Text style={{ fontSize: 34, fontWeight: "800", color: c.fg, letterSpacing: -1, marginBottom: 8 }}>
                {formatPKR(totalValue)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
                  backgroundColor: totalPL >= 0 ? c.gainDim : c.lossDim,
                }}>
                  {totalPL >= 0
                    ? <TrendingUp size={12} color={c.gain} />
                    : <TrendingDown size={12} color={c.loss} />}
                  <Text style={{ fontSize: 13, fontWeight: "700", color: plColor(totalPL) }}>
                    {totalPL >= 0 ? "+" : ""}{formatPKR(totalPL)}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: plColor(totalPLPct) }}>
                  {totalPLPct >= 0 ? "+" : ""}{formatPercent(totalPLPct)}
                </Text>
                <Text style={{ fontSize: 12, color: c.muted, marginLeft: "auto" as any }}>
                  {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* ── KSE Indices ─────────────────────────── */}
        <View style={{ marginTop: 20, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.fg }}>Market Indices</Text>
            <Pressable onPress={() => router.push("/market/psx" as never)}>
              <Text style={{ fontSize: 12, color: c.primary, fontWeight: "600" }}>View all</Text>
            </Pressable>
          </View>
          {mktLoading && indices.length === 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
              {["KSE 100", "KSE 30", "KMI 30"].map((l) => (
                <View key={l} style={{ width: 140, height: 90, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator size="small" color={c.primary} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {indices.map((idx) => (
                <IndexCard key={idx.symbol} label={idx.label} value={idx.current} pct={idx.changePct} c={c} />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Market Movers ───────────────────────── */}
        <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 20 }}>
          {/* Gainers */}
          <View style={{ flex: 1, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <TrendingUp size={14} color={c.gain} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: c.gain, letterSpacing: 0.5 }}>Top Gainers</Text>
            </View>
            {mktLoading && gainers.length === 0 ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : gainers.map((item, i) => (
              <MoverRow key={item.symbol} item={item} c={c} rank={i + 1} />
            ))}
          </View>
          {/* Losers */}
          <View style={{ flex: 1, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <TrendingDown size={14} color={c.loss} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: c.loss, letterSpacing: 0.5 }}>Top Losers</Text>
            </View>
            {mktLoading && losers.length === 0 ? (
              <ActivityIndicator size="small" color={c.primary} />
            ) : losers.map((item, i) => (
              <MoverRow key={item.symbol} item={item} c={c} rank={i + 1} />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
