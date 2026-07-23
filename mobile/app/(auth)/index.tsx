import { View, Text, TouchableOpacity, ScrollView, Dimensions, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { TrendingUp, TrendingDown, Shield, Bell, Wallet, BarChart3, Globe2, ArrowRight, Zap } from "lucide-react-native";

const { width } = Dimensions.get("window");

const MOVERS = [
  { symbol: "ENGRO", change: +4.32 },
  { symbol: "LUCK",  change: -2.18 },
  { symbol: "HBL",   change: +3.67 },
  { symbol: "PSO",   change: -1.44 },
  { symbol: "OGDC",  change: +2.91 },
  { symbol: "MCB",   change: +1.55 },
  { symbol: "UBL",   change: -0.87 },
];

const FEATURES = [
  { icon: BarChart3, label: "Live PSX Data",    sub: "Real-time prices",      color: "#34d399" },
  { icon: Wallet,    label: "Portfolio P/L",    sub: "Track gains & losses",  color: "#38bdf8" },
  { icon: Bell,      label: "Price Alerts",     sub: "Instant notifications", color: "#fb923c" },
  { icon: Globe2,    label: "9+ Markets",       sub: "PSX, Funds, Crypto",    color: "#a78bfa" },
  { icon: Shield,    label: "Secure & Private", sub: "Your data, your own",   color: "#fbbf24" },
  { icon: Zap,       label: "30-sec Refresh",   sub: "Always up to date",     color: "#f472b6" },
];

const S = {
  bg: { flex: 1, backgroundColor: "#04100d" } as const,
  nav: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  navBrand: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  navLogo: { width: 36, height: 36, borderRadius: 9 },
  navTitle: { fontSize: 20, fontWeight: "800" as const, color: "#eef3f2", letterSpacing: -0.5 },
  navBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.07)" },
  navBtnText: { fontSize: 13, fontWeight: "600" as const, color: "#eef3f2" },
  hero: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36 },
  badge: { flexDirection: "row" as const, alignItems: "center" as const, gap: 7, alignSelf: "flex-start" as const, backgroundColor: "rgba(52,211,153,0.12)", borderWidth: 1, borderColor: "rgba(52,211,153,0.28)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 22 },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#34d399" },
  badgeText: { fontSize: 12, fontWeight: "700" as const, color: "#34d399" },
  headline: { fontSize: 42, fontWeight: "800" as const, color: "#eef3f2", lineHeight: 50, letterSpacing: -1.5, marginBottom: 14 },
  headlineAccent: { color: "#34d399" },
  subtext: { fontSize: 16, color: "#7a9098", lineHeight: 26, marginBottom: 34 },
  ctaWrap: { gap: 12, marginBottom: 32 },
  btnPrimary: { backgroundColor: "#34d399", paddingVertical: 17, borderRadius: 16, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 },
  btnPrimaryText: { fontSize: 16, fontWeight: "700" as const, color: "#04100d" },
  btnSecondary: { paddingVertical: 17, borderRadius: 16, alignItems: "center" as const, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.06)" },
  btnSecondaryText: { fontSize: 16, fontWeight: "600" as const, color: "#eef3f2" },
  tickerLabel: { fontSize: 10, fontWeight: "700" as const, color: "#7a9098", letterSpacing: 1.4, textTransform: "uppercase" as const, marginBottom: 10 },
  featureSection: { backgroundColor: "#091610", paddingVertical: 36, paddingHorizontal: 24 },
  sectionEyebrow: { fontSize: 11, fontWeight: "700" as const, color: "#34d399", letterSpacing: 1.6, textTransform: "uppercase" as const, marginBottom: 4 },
  sectionTitle: { fontSize: 22, fontWeight: "700" as const, color: "#eef3f2", marginBottom: 22, letterSpacing: -0.3 },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 12 },
  marketsSection: { paddingVertical: 36, paddingHorizontal: 24 },
  ctaBox: { margin: 24, marginTop: 4, borderRadius: 24, backgroundColor: "#0d2b22", borderWidth: 1, borderColor: "rgba(52,211,153,0.22)", padding: 26 },
  ctaBoxTitle: { fontSize: 23, fontWeight: "800" as const, color: "#eef3f2", lineHeight: 31, marginBottom: 8, letterSpacing: -0.5 },
  ctaBoxSub: { fontSize: 14, color: "#7a9098", lineHeight: 22, marginBottom: 22 },
};

export default function LandingScreen() {
  return (
    <View style={S.bg}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 56 }} bounces={false}>
        <SafeAreaView edges={["top"]}>
          {/* Nav */}
          <View style={S.nav}>
            <View style={S.navBrand}>
              <Image source={require("../../assets/images/icon.png")} style={S.navLogo} />
              <Text style={S.navTitle}>MyStockli</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/(auth)/login")} style={S.navBtn}>
              <Text style={S.navBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={S.hero}>
            <View style={S.badge}>
              <View style={S.badgeDot} />
              <Text style={S.badgeText}>Live Market Data</Text>
            </View>

            <Text style={S.headline}>
              Your entire{"\n"}market,{"\n"}
              <Text style={S.headlineAccent}>on MyStockli.</Text>
            </Text>

            <Text style={S.subtext}>
              Track PSX stocks, mutual funds, ETFs, crypto and global indices — with real-time P/L and smart alerts.
            </Text>

            <View style={S.ctaWrap}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/(auth)/signup")} style={S.btnPrimary}>
                <Text style={S.btnPrimaryText}>Start tracking free</Text>
                <ArrowRight size={17} color="#04100d" />
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/(auth)/login")} style={S.btnSecondary}>
                <Text style={S.btnSecondaryText}>Sign in to account</Text>
              </TouchableOpacity>
            </View>

            <Text style={S.tickerLabel}>Sample market data</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24 }} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
              {MOVERS.map((m) => (
                <View key={m.symbol} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: m.change > 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)", borderWidth: 1, borderColor: m.change > 0 ? "rgba(74,222,128,0.22)" : "rgba(248,113,113,0.22)" }}>
                  {m.change > 0 ? <TrendingUp size={11} color="#4ade80" /> : <TrendingDown size={11} color="#f87171" />}
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#eef3f2" }}>{m.symbol}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: m.change > 0 ? "#4ade80" : "#f87171" }}>
                    {m.change > 0 ? "+" : ""}{m.change.toFixed(2)}%
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </SafeAreaView>

        {/* Features */}
        <View style={S.featureSection}>
          <Text style={S.sectionEyebrow}>Everything you need</Text>
          <Text style={S.sectionTitle}>A complete market toolkit</Text>
          <View style={S.grid}>
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <View key={f.label} style={{ width: (width - 60) / 2, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: f.color + "1c", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Icon size={19} color={f.color} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#eef3f2", marginBottom: 3 }}>{f.label}</Text>
                  <Text style={{ fontSize: 12, color: "#7a9098", lineHeight: 18 }}>{f.sub}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Markets */}
        <View style={S.marketsSection}>
          <Text style={S.sectionEyebrow}>Market coverage</Text>
          <Text style={S.sectionTitle}>All markets, one app</Text>
          {[
            { label: "Pakistan Stock Exchange", tag: "PSX",    color: "#34d399", sub: "KSE100 · KSE30 · KMI30 · All sectors" },
            { label: "MUFAP Mutual Funds",       tag: "FUNDS",  color: "#38bdf8", sub: "NAV · Returns · Fund comparison" },
            { label: "US & World Indices",        tag: "GLOBAL", color: "#a78bfa", sub: "S&P 500 · NASDAQ · Dow Jones" },
            { label: "Commodities & Crypto",      tag: "CRYPTO", color: "#fbbf24", sub: "Gold · Oil · BTC · ETH" },
          ].map((m, i, arr) => (
            <View key={m.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 15, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: "rgba(255,255,255,0.08)", gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#eef3f2", marginBottom: 2 }}>{m.label}</Text>
                <Text style={{ fontSize: 12, color: "#7a9098" }}>{m.sub}</Text>
              </View>
              <View style={{ backgroundColor: m.color + "1c", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, borderWidth: 1, borderColor: m.color + "33" }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: m.color, letterSpacing: 0.6 }}>{m.tag}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Final CTA */}
        <View style={S.ctaBox}>
          <Text style={S.ctaBoxTitle}>The smartest way to track Pakistan markets.</Text>
          <Text style={S.ctaBoxSub}>Free forever. No credit card. Trusted by thousands of PSX investors.</Text>
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/(auth)/signup")} style={S.btnPrimary}>
            <Text style={S.btnPrimaryText}>Get started — it's free</Text>
            <ArrowRight size={15} color="#04100d" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
