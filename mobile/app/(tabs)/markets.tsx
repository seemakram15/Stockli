import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, TrendingUp, Globe2, Gem, Bitcoin, Droplets } from "lucide-react-native";
import { router } from "expo-router";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";

const MARKET_SECTIONS = [
  {
    label: "Pakistan",
    items: [
      { title: "PSX Market", sub: "KSE100 · KSE30 · KMI30", icon: TrendingUp, color: colors.gain, href: "/market/psx" },
      { title: "Sector Performance", sub: "All PSX sectors", icon: TrendingUp, color: colors.sky, href: "/market/sectors" },
      { title: "Mutual Funds", sub: "MUFAP · NAV · Returns", icon: TrendingUp, color: colors.accent, href: "/market/mutual-funds" },
      { title: "ETFs", sub: "Exchange Traded Funds", icon: TrendingUp, color: colors.accent, href: "/market/etfs" },
      { title: "FIPI / LIPI", sub: "Investor flow data", icon: TrendingUp, color: colors.warn, href: "/market/fipi-lipi" },
    ],
  },
  {
    label: "International",
    items: [
      { title: "USA · S&P 500", sub: "US stock market", icon: Globe2, color: colors.sky, href: "/market/us" },
      { title: "India", sub: "India stock market", icon: Globe2, color: colors.rose, href: "/market/india" },
      { title: "World", sub: "Global exchanges", icon: Globe2, color: colors.accent, href: "/market/world" },
    ],
  },
  {
    label: "Commodities & Crypto",
    items: [
      { title: "Commodities", sub: "Gold, Silver, Copper…", icon: Gem, color: colors.amber, href: "/market/commodities" },
      { title: "Oil & Energy", sub: "WTI, Brent, Natural Gas", icon: Droplets, color: colors.orange, href: "/market/oil" },
      { title: "Crypto", sub: "BTC, ETH, SOL…", icon: Bitcoin, color: colors.violet, href: "/market/crypto" },
    ],
  },
];

export default function MarketsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="py-2">
          <ThemedText variant="title">Markets</ThemedText>
        </View>

        {MARKET_SECTIONS.map((section) => (
          <View key={section.label} className="gap-2">
            <ThemedText variant="label" className="ml-1">{section.label}</ThemedText>
            <Card className="p-0 overflow-hidden">
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.title}
                    onPress={() => {/* navigate */}}
                    className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-2 ${i < section.items.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <View className="size-9 items-center justify-center rounded-xl" style={{ backgroundColor: item.color + "20" }}>
                      <Icon size={16} color={item.color} />
                    </View>
                    <View className="flex-1">
                      <ThemedText variant="subhead" className="text-[15px] font-semibold text-text">{item.title}</ThemedText>
                      <ThemedText variant="caption" className="mt-0.5">{item.sub}</ThemedText>
                    </View>
                    <ChevronRight size={16} color={colors.muted} />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
