import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart3, TrendingUp, TrendingDown, RefreshCw } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";

const PLACEHOLDER_SUMMARY = [
  { label: "Total Value", value: "Rs 0", sub: "No portfolios yet" },
  { label: "Day P/L", value: "—", sub: "—" },
  { label: "Total P/L", value: "—", sub: "—" },
];

const PLACEHOLDER_INDICES = [
  { name: "KSE 100", value: "—", change: null },
  { name: "KSE 30", value: "—", change: null },
  { name: "KMI 30", value: "—", change: null },
];

export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between py-2">
          <View>
            <ThemedText variant="label" className="mb-0.5">Pakistan Stock Exchange</ThemedText>
            <ThemedText variant="title">Dashboard</ThemedText>
          </View>
          <Pressable className="size-9 items-center justify-center rounded-full bg-surface">
            <RefreshCw size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* KSE Index Strip */}
        <View className="flex-row gap-2">
          {PLACEHOLDER_INDICES.map((idx) => (
            <Card key={idx.name} className="flex-1 p-3">
              <ThemedText variant="label" className="mb-1">{idx.name}</ThemedText>
              <ThemedText variant="subhead" className="text-text">{idx.value}</ThemedText>
              <ThemedText variant="caption" className="mt-0.5 text-muted">—</ThemedText>
            </Card>
          ))}
        </View>

        {/* Portfolio Summary */}
        <Card>
          <ThemedText variant="label" className="mb-3">My Portfolios</ThemedText>
          <View className="gap-3">
            {PLACEHOLDER_SUMMARY.map((item) => (
              <View key={item.label} className="flex-row items-center justify-between">
                <ThemedText variant="caption">{item.label}</ThemedText>
                <View className="items-end">
                  <ThemedText variant="subhead" className="text-text">{item.value}</ThemedText>
                  <ThemedText variant="caption" className="text-muted">{item.sub}</ThemedText>
                </View>
              </View>
            ))}
          </View>
          <Pressable className="mt-4 items-center rounded-xl border border-border py-2.5">
            <Text className="text-[14px] font-semibold text-accent">View all portfolios</Text>
          </Pressable>
        </Card>

        {/* Market Movers placeholder */}
        <View className="flex-row gap-2">
          <Card className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <TrendingUp size={14} color={colors.gain} />
              <ThemedText variant="label" className="text-gain">Top Gainers</ThemedText>
            </View>
            <ThemedText variant="caption" className="text-center text-muted py-4">Loading market data…</ThemedText>
          </Card>
          <Card className="flex-1">
            <View className="mb-2 flex-row items-center gap-2">
              <TrendingDown size={14} color={colors.loss} />
              <ThemedText variant="label" className="text-loss">Top Losers</ThemedText>
            </View>
            <ThemedText variant="caption" className="text-center text-muted py-4">Loading market data…</ThemedText>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
