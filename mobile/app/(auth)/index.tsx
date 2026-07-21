import { View, Text, Pressable, ScrollView, Dimensions, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TrendingUp, TrendingDown, Shield, Bell, Wallet, BarChart3, Globe2, ArrowRight, Zap } from "lucide-react-native";

const { width } = Dimensions.get("window");

const MOVERS = [
  { symbol: "ENGRO",  change: +4.32 },
  { symbol: "LUCK",   change: -2.18 },
  { symbol: "HBL",    change: +3.67 },
  { symbol: "PSO",    change: -1.44 },
  { symbol: "OGDC",   change: +2.91 },
  { symbol: "MCB",    change: +1.55 },
  { symbol: "UBL",    change: -0.87 },
];

const FEATURES = [
  { icon: BarChart3, label: "Live PSX Data",    sub: "Real-time prices",     color: "#34d399" },
  { icon: Wallet,    label: "Portfolio P/L",    sub: "Track gains & losses", color: "#38bdf8" },
  { icon: Bell,      label: "Price Alerts",     sub: "Instant notify",       color: "#fb923c" },
  { icon: Globe2,    label: "9+ Markets",       sub: "PSX, Funds, Crypto",   color: "#a78bfa" },
  { icon: Shield,    label: "Secure & Private", sub: "Your data, your own",  color: "#fbbf24" },
  { icon: Zap,       label: "30-sec Refresh",   sub: "Always up to date",    color: "#f472b6" },
];

export default function LandingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#04100d" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
        bounces={false}
      >
        <SafeAreaView edges={["top"]}>
          {/* ── Nav bar ─────────────────────── */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Image
                source={require("../../assets/images/icon.png")}
                style={{ width: 34, height: 34, borderRadius: 8 }}
              />
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#eef3f2", letterSpacing: -0.5 }}>
                Stockli
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/(auth)/login")}
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#eef3f2" }}>Sign in</Text>
            </Pressable>
          </View>

          {/* ── Hero ─────────────────────────── */}
          <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}>
            {/* Badge */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20, alignSelf: "flex-start", backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.25)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#34d399" }} />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#34d399" }}>Live Market Data</Text>
            </View>

            <Text style={{ fontSize: 42, fontWeight: "800", color: "#eef3f2", lineHeight: 50, letterSpacing: -1.5, marginBottom: 16 }}>
              Your entire{"\n"}market,{"\n"}
              <Text style={{ color: "#34d399" }}>on Stockli.</Text>
            </Text>

            <Text style={{ fontSize: 16, color: "#7a9098", lineHeight: 26, marginBottom: 36 }}>
              Track PSX stocks, mutual funds, ETFs, crypto and global indices — with real-time P/L and smart alerts.
            </Text>

            {/* CTA Buttons */}
            <View style={{ gap: 12, marginBottom: 36 }}>
              <Pressable
                onPress={() => router.push("/(auth)/signup")}
                style={({ pressed }) => ({
                  backgroundColor: "#34d399",
                  paddingVertical: 17,
                  borderRadius: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#04100d" }}>Start tracking free</Text>
                <ArrowRight size={16} color="#04100d" />
              </Pressable>
              <Pressable
                onPress={() => router.push("/(auth)/login")}
                style={({ pressed }) => ({
                  paddingVertical: 17,
                  borderRadius: 16,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.14)",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#eef3f2" }}>Sign in to account</Text>
              </Pressable>
            </View>

            {/* Live ticker */}
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#7a9098", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
              Sample market data
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
              {MOVERS.map((m) => (
                <View key={m.symbol} style={{
                  flexDirection: "row", alignItems: "center", gap: 6,
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                  backgroundColor: m.change > 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                  borderWidth: 1,
                  borderColor: m.change > 0 ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
                }}>
                  {m.change > 0
                    ? <TrendingUp size={11} color="#4ade80" />
                    : <TrendingDown size={11} color="#f87171" />}
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#eef3f2" }}>{m.symbol}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: m.change > 0 ? "#4ade80" : "#f87171" }}>
                    {m.change > 0 ? "+" : ""}{m.change.toFixed(2)}%
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>

        {/* ── Features ─────────────────────── */}
        <View style={{ backgroundColor: "#0a1a13", paddingVertical: 36, paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#34d399", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
            Everything you need
          </Text>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#eef3f2", marginBottom: 24, letterSpacing: -0.3 }}>
            A complete market toolkit
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <View key={f.label} style={{
                  width: (width - 60) / 2,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.07)",
                  borderRadius: 18,
                  padding: 18,
                }}>
                  <View style={{
                    width: 40, height: 40, borderRadius: 12,
                    backgroundColor: f.color + "1a",
                    alignItems: "center", justifyContent: "center",
                    marginBottom: 12,
                  }}>
                    <Icon size={18} color={f.color} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#eef3f2", marginBottom: 3 }}>{f.label}</Text>
                  <Text style={{ fontSize: 12, color: "#7a9098", lineHeight: 18 }}>{f.sub}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Markets covered ──────────────── */}
        <View style={{ paddingVertical: 36, paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#34d399", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
            Market coverage
          </Text>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#eef3f2", marginBottom: 24, letterSpacing: -0.3 }}>
            All markets, one app
          </Text>
          {[
            { label: "Pakistan Stock Exchange", tag: "PSX",    color: "#34d399", sub: "KSE100 · KSE30 · KMI30 · All sectors" },
            { label: "MUFAP Mutual Funds",       tag: "FUNDS",  color: "#38bdf8", sub: "NAV · Returns · Fund comparison" },
            { label: "US & World Indices",        tag: "GLOBAL", color: "#a78bfa", sub: "S&P 500 · NASDAQ · Dow Jones" },
            { label: "Commodities & Crypto",      tag: "CRYPTO", color: "#fbbf24", sub: "Gold · Oil · BTC · ETH" },
          ].map((m, i, arr) => (
            <View key={m.label} style={{
              flexDirection: "row", alignItems: "center",
              paddingVertical: 16,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0,
              borderBottomColor: "rgba(255,255,255,0.07)",
              gap: 14,
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#eef3f2", marginBottom: 2 }}>{m.label}</Text>
                <Text style={{ fontSize: 12, color: "#7a9098" }}>{m.sub}</Text>
              </View>
              <View style={{ backgroundColor: m.color + "1a", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: m.color + "30" }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: m.color, letterSpacing: 0.5 }}>{m.tag}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Final CTA ────────────────────── */}
        <View style={{ marginHorizontal: 24 }}>
          <View style={{
            borderRadius: 24, overflow: "hidden",
            backgroundColor: "#0d2b22",
            borderWidth: 1, borderColor: "rgba(52,211,153,0.2)",
            padding: 28,
          }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#eef3f2", lineHeight: 32, marginBottom: 8, letterSpacing: -0.5 }}>
              The smartest way to track Pakistan markets.
            </Text>
            <Text style={{ fontSize: 14, color: "#7a9098", lineHeight: 22, marginBottom: 24 }}>
              Free forever. No credit card. Trusted by thousands of PSX investors.
            </Text>
            <Pressable
              onPress={() => router.push("/(auth)/signup")}
              style={({ pressed }) => ({
                backgroundColor: "#34d399",
                paddingVertical: 16,
                borderRadius: 14,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#04100d" }}>Get started — it's free</Text>
              <ArrowRight size={15} color="#04100d" />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
