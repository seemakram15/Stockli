import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TrendingUp, TrendingDown, Search, Bell, Globe2, Zap, AlertTriangle, CloudRain } from "lucide-react-native";
import Svg, { Polyline, Defs, LinearGradient, Stop, Path } from "react-native-svg";
import useSWR from "swr";
import { useColors } from "@/lib/theme";
import { usePublicMarket, usePrices } from "@/hooks/useMarket";
import { usePortfolios, useAllHoldings } from "@/hooks/usePortfolio";
import { formatPKR, formatPercent, plColor } from "@/lib/format";
import { useSession } from "@/hooks/useSession";
import { api } from "@/lib/api";

const INDEX_LABELS: Record<string, string> = {
  KSE100: "KSE 100",
  KSE30: "KSE 30",
  KMI30: "KMI 30",
  ALLSHR: "All Shares",
};

function SparkChart({ data, color, height = 80 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const w = 340;
  const h = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });
  const linePoints = pts.join(" ");
  const areaPath = `M${pts[0]} L${pts.join(" L")} L${w},${h} L0,${h} Z`;

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.18" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill={`url(#grad-${color.replace("#","")})`} />
      <Polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function WorldTile({ label, value, change, changePct, currency }: { label: string; value: number; change: number; changePct: number; currency?: string }) {
  const c = useColors();
  const up = changePct >= 0;
  return (
    <View style={{ flex: 1, borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 12, gap: 4 }}>
      <Text style={{ fontSize: 10, color: c.muted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }} numberOfLines={1}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "800", color: c.fg, letterSpacing: -0.3 }}>
        {currency === "USD" ? "$" : ""}{value >= 1000 ? value.toLocaleString("en-US", { maximumFractionDigits: 0 }) : value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start", backgroundColor: up ? c.gainDim : c.lossDim }}>
        {up ? <TrendingUp size={9} color={c.gain} /> : <TrendingDown size={9} color={c.loss} />}
        <Text style={{ fontSize: 10, fontWeight: "700", color: up ? c.gain : c.loss }}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</Text>
      </View>
    </View>
  );
}

const CATEGORY_ICON: Record<string, any> = {
  conflict: AlertTriangle,
  disaster: CloudRain,
  market: Zap,
};

export default function DashboardScreen() {
  const c = useColors();
  const { user } = useSession();
  const { data: marketData, isLoading: mktLoading, mutate: refreshMkt } = usePublicMarket();
  const { data: worldData, isLoading: worldLoading } = useSWR("world-monitor", api.market.worldMonitor, { revalidateOnFocus: false });
  const { data: portfolios = [] } = usePortfolios();
  const { data: holdings = [] } = useAllHoldings();
  const allSymbols = [...new Set(holdings.map((h) => h.symbol))];
  const { data: quotes = [] } = usePrices(allSymbols);

  const [selectedIndex, setSelectedIndex] = useState("KSE100");

  const market = (marketData as any)?.data;
  const allCards: any[] = market?.cards ?? [];
  const indexCards = allCards.filter((c: any) => ["KSE100", "KSE30", "KMI30", "ALLSHR"].includes(c.symbol));
  const selectedCard = indexCards.find((c: any) => c.symbol === selectedIndex) ?? indexCards[0];

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

  const worldRaw = (worldData as any)?.data;
  const snapshot = worldRaw?.marketSnapshot ?? {};
  const intelFeed: any[] = (worldRaw?.intelFeed ?? []).slice(0, 6);
  const hotspots: any[] = (worldRaw?.hotspots ?? []).slice(0, 4);

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
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Image source={require("../../assets/images/icon.png")} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <View>
              <Text style={{ fontSize: 11, color: c.muted, fontWeight: "600" }}>{greeting}</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: c.fg, letterSpacing: -0.3 }}>{displayName}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => router.push("/search")} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <Search size={16} color={c.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/alerts")} activeOpacity={0.7} style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} color={c.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Portfolio Hero */}
        {portfolios.length > 0 && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/(tabs)/portfolios")} style={{ marginHorizontal: 20, marginTop: 12, marginBottom: 4 }}>
            <View style={{ borderRadius: 20, padding: 22, backgroundColor: c.card, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: c.muted, marginBottom: 6 }}>Total Portfolio Value</Text>
              <Text style={{ fontSize: 34, fontWeight: "800", color: c.fg, letterSpacing: -1, marginBottom: 10 }}>
                {formatPKR(totalValue)}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 5,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
                  backgroundColor: totalPL >= 0 ? c.gainDim : c.lossDim,
                }}>
                  {totalPL >= 0 ? <TrendingUp size={12} color={c.gain} /> : <TrendingDown size={12} color={c.loss} />}
                  <Text style={{ fontSize: 13, fontWeight: "700", color: plColor(totalPL, c) }}>
                    {totalPL >= 0 ? "+" : ""}{formatPKR(Math.abs(totalPL))}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "600", color: plColor(totalPLPct, c) }}>
                  {formatPercent(totalPLPct)}
                </Text>
                <Text style={{ fontSize: 12, color: c.muted, marginLeft: "auto" as any }}>
                  {portfolios.length} portfolio{portfolios.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Market Indices 2x2 Grid */}
        <View style={{ marginTop: 20, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: c.fg, marginBottom: 12 }}>Market Indices</Text>
          {mktLoading && indexCards.length === 0 ? (
            <View style={{ height: 140, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {indexCards.slice(0, 2).map((idx) => {
                  const up = idx.changePct >= 0;
                  const active = selectedIndex === idx.symbol;
                  return (
                    <TouchableOpacity
                      key={idx.symbol}
                      activeOpacity={0.75}
                      onPress={() => setSelectedIndex(idx.symbol)}
                      style={{
                        flex: 1, borderRadius: 16, padding: 14,
                        backgroundColor: active ? c.primary + "15" : c.card,
                        borderWidth: 1.5, borderColor: active ? c.primary : c.border,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: active ? c.primary : c.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                        {INDEX_LABELS[idx.symbol] ?? idx.symbol}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: c.fg, letterSpacing: -0.5, marginBottom: 6 }}>
                        {idx.current.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start", backgroundColor: up ? c.gainDim : c.lossDim }}>
                        {up ? <TrendingUp size={9} color={c.gain} /> : <TrendingDown size={9} color={c.loss} />}
                        <Text style={{ fontSize: 10, fontWeight: "700", color: up ? c.gain : c.loss }}>{formatPercent(idx.changePct)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {indexCards.slice(2, 4).map((idx) => {
                  const up = idx.changePct >= 0;
                  const active = selectedIndex === idx.symbol;
                  return (
                    <TouchableOpacity
                      key={idx.symbol}
                      activeOpacity={0.75}
                      onPress={() => setSelectedIndex(idx.symbol)}
                      style={{
                        flex: 1, borderRadius: 16, padding: 14,
                        backgroundColor: active ? c.primary + "15" : c.card,
                        borderWidth: 1.5, borderColor: active ? c.primary : c.border,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: active ? c.primary : c.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                        {INDEX_LABELS[idx.symbol] ?? idx.symbol}
                      </Text>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: c.fg, letterSpacing: -0.5, marginBottom: 6 }}>
                        {idx.current.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: "flex-start", backgroundColor: up ? c.gainDim : c.lossDim }}>
                        {up ? <TrendingUp size={9} color={c.gain} /> : <TrendingDown size={9} color={c.loss} />}
                        <Text style={{ fontSize: 10, fontWeight: "700", color: up ? c.gain : c.loss }}>{formatPercent(idx.changePct)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Selected Index Chart */}
        {selectedCard && selectedCard.spark && (
          <View style={{ marginHorizontal: 20, marginTop: 12, borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  {INDEX_LABELS[selectedCard.symbol] ?? selectedCard.symbol}  •  30-Day
                </Text>
                <Text style={{ fontSize: 22, fontWeight: "800", color: c.fg, marginTop: 2, letterSpacing: -0.5 }}>
                  {selectedCard.current.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                </Text>
              </View>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
                backgroundColor: selectedCard.changePct >= 0 ? c.gainDim : c.lossDim,
              }}>
                {selectedCard.changePct >= 0 ? <TrendingUp size={11} color={c.gain} /> : <TrendingDown size={11} color={c.loss} />}
                <Text style={{ fontSize: 12, fontWeight: "700", color: selectedCard.changePct >= 0 ? c.gain : c.loss }}>
                  {formatPercent(selectedCard.changePct)}
                </Text>
              </View>
            </View>
            <View style={{ height: 80, paddingBottom: 4 }}>
              <SparkChart data={selectedCard.spark} color={selectedCard.changePct >= 0 ? c.gain : c.loss} height={80} />
            </View>
          </View>
        )}

        {/* World View */}
        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Globe2 size={15} color={c.primary} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: c.fg }}>World View</Text>
          </View>

          {worldLoading && !worldRaw ? (
            <View style={{ height: 80, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={c.primary} />
            </View>
          ) : (
            <>
              {/* Key Market Tiles */}
              {snapshot.gold && (
                <View style={{ gap: 10, marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {snapshot.gold && <WorldTile label="Gold" value={snapshot.gold.price} change={snapshot.gold.change} changePct={snapshot.gold.changePct} currency="USD" />}
                    {snapshot.brent && <WorldTile label="Brent Crude" value={snapshot.brent.price} change={snapshot.brent.change} changePct={snapshot.brent.changePct} currency="USD" />}
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {snapshot.bitcoin && <WorldTile label="Bitcoin" value={snapshot.bitcoin.price} change={snapshot.bitcoin.change} changePct={snapshot.bitcoin.changePct} currency="USD" />}
                    {snapshot.best && <WorldTile label={snapshot.best.name} value={snapshot.best.price} change={snapshot.best.change} changePct={snapshot.best.changePct} />}
                  </View>
                </View>
              )}

              {/* Market Tone */}
              {snapshot.tone && (
                <View style={{ borderRadius: 14, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 14, marginBottom: 14, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Zap size={13} color={c.primary} />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: c.primary, textTransform: "uppercase", letterSpacing: 0.8 }}>
                      Market Tone: {snapshot.tone.replace("-", " ")}
                    </Text>
                  </View>
                  {(snapshot.signals ?? []).map((s: string, i: number) => (
                    <Text key={i} style={{ fontSize: 12, color: c.muted, lineHeight: 18 }}>• {s}</Text>
                  ))}
                </View>
              )}

              {/* Geopolitical Hotspots */}
              {hotspots.length > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    Geopolitical Watch
                  </Text>
                  <View style={{ borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
                    {hotspots.map((h, i) => {
                      const severity = h.severity === "critical" ? c.loss : h.severity === "high" ? c.warn : c.muted;
                      return (
                        <View key={h.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: i < hotspots.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: severity, marginTop: 5 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: c.fg }}>{h.name}</Text>
                            <Text style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>{h.region}  ·  {h.eventCount} events</Text>
                            <Text style={{ fontSize: 11, color: c.muted, marginTop: 3, lineHeight: 16 }} numberOfLines={2}>{h.lead}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Intel Feed */}
              {intelFeed.length > 0 && (
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    World Intel Feed
                  </Text>
                  <View style={{ borderRadius: 16, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
                    {intelFeed.map((item, i) => {
                      const Icon = CATEGORY_ICON[item.category] ?? Globe2;
                      const iconColor = item.category === "conflict" ? c.loss : item.category === "disaster" ? c.warn : c.primary;
                      return (
                        <View key={item.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderBottomWidth: i < intelFeed.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: iconColor + "18", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                            <Icon size={13} color={iconColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: c.fg, lineHeight: 17 }} numberOfLines={2}>{item.title}</Text>
                            <Text style={{ fontSize: 10, color: c.muted, marginTop: 3 }}>{item.category}  ·  {new Date(item.publishedAt).toLocaleDateString("en-PK", { month: "short", day: "numeric" })}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
