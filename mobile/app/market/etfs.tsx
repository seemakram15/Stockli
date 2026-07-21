import { View, FlatList, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { colors, useColors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { usePublicMarket } from "@/hooks/useMarket";
import { formatPKR, formatPercent, plColor } from "@/lib/format";

interface EtfRow { symbol: string; company_name?: string; current: number; changePct: number; change: number; listedIn?: string }

export default function EtfsScreen() {
  const c = useColors();
  const { data: marketData, isLoading } = usePublicMarket();
  const allRows: EtfRow[] = (marketData as { data?: { rows?: EtfRow[] } } | undefined)?.data?.rows ?? [];
  const etfs = allRows.filter((r) => r.listedIn === "ETF" || r.symbol?.startsWith("ETF"));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-4">
        <Pressable onPress={() => router.back()} className="size-9 items-center justify-center">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <ThemedText variant="title">ETFs</ThemedText>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : etfs.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ThemedText variant="body" className="text-muted">No ETF data available</ThemedText>
        </View>
      ) : (
        <FlatList
          data={etfs}
          keyExtractor={(r) => r.symbol}
          renderItem={({ item }) => {
            const color = plColor(item.changePct);
            return (
              <Pressable
                className="flex-row items-center px-4 py-3 border-b border-border active:opacity-70"
                onPress={() => router.push(`/stock/${item.symbol}`)}
              >
                <View className="flex-1">
                  <ThemedText variant="body">{item.symbol}</ThemedText>
                  {item.company_name ? <ThemedText variant="caption" className="text-muted" numberOfLines={1}>{item.company_name}</ThemedText> : null}
                </View>
                <View className="items-end">
                  <ThemedText variant="body" className="text-fg">{formatPKR(item.current)}</ThemedText>
                  <ThemedText variant="caption" style={{ color }}>{item.changePct >= 0 ? "+" : ""}{formatPercent(item.changePct)}</ThemedText>
                </View>
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
        />
      )}
    </SafeAreaView>
  );
}
