import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, TrendingUp, Globe2, Gem, Bitcoin, Droplets, BarChart3, Banknote } from "lucide-react-native";
import { router } from "expo-router";
import { useColors, type Colors } from "@/lib/theme";

type ColorKey = keyof Colors;

const MARKET_SECTIONS: { label: string; items: { title: string; sub: string; icon: any; colorKey: ColorKey; href: string }[] }[] = [
  {
    label: "Pakistan",
    items: [
      { title: "PSX Market",         sub: "KSE100 · KSE30 · KMI30 · All stocks",  icon: TrendingUp,  colorKey: "gain",    href: "/market/psx" },
      { title: "Sector Performance", sub: "All PSX sectors ranked by return",       icon: BarChart3,   colorKey: "sky",     href: "/market/sectors" },
      { title: "Mutual Funds",        sub: "MUFAP · NAV · Category returns",        icon: Banknote,    colorKey: "primary", href: "/market/mutual-funds" },
      { title: "ETFs",                sub: "Exchange Traded Funds",                 icon: TrendingUp,  colorKey: "emerald", href: "/market/etfs" },
      { title: "FIPI / LIPI",         sub: "Foreign & local investor flow data",    icon: TrendingUp,  colorKey: "warn",    href: "/market/fipi-lipi" },
    ],
  },
  {
    label: "International",
    items: [
      { title: "USA · S&P 500", sub: "US equity market",          icon: Globe2, colorKey: "sky",     href: "/market/us" },
      { title: "India · NIFTY", sub: "Indian stock exchange",     icon: Globe2, colorKey: "rose",    href: "/market/india" },
      { title: "World Indices", sub: "Global exchanges overview",  icon: Globe2, colorKey: "primary", href: "/market/world" },
    ],
  },
  {
    label: "Commodities & Crypto",
    items: [
      { title: "Commodities",  sub: "Gold, Silver, Copper, Iron",    icon: Gem,     colorKey: "amber",  href: "/market/commodities" },
      { title: "Oil & Energy", sub: "WTI, Brent, Natural Gas",       icon: Droplets, colorKey: "orange", href: "/market/oil" },
      { title: "Crypto",       sub: "BTC, ETH, SOL and more",        icon: Bitcoin, colorKey: "violet", href: "/market/crypto" },
    ],
  },
];

export default function MarketsScreen() {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: c.fg, letterSpacing: -0.8 }}>Markets</Text>
          <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>Real-time data across 9+ markets</Text>
        </View>

        {MARKET_SECTIONS.map((section) => (
          <View key={section.label} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted, letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 20, marginBottom: 8 }}>
              {section.label}
            </Text>
            <View style={{ marginHorizontal: 20, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
              {section.items.map((item, i) => {
                const Icon = item.icon;
                const color = c[item.colorKey] as string;
                return (
                  <Pressable
                    key={item.title}
                    onPress={() => router.push(item.href as never)}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
                      borderBottomWidth: i < section.items.length - 1 ? 1 : 0,
                      borderBottomColor: c.border,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + "20", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={17} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: c.fg }}>{item.title}</Text>
                      <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{item.sub}</Text>
                    </View>
                    <ChevronRight size={16} color={c.muted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
