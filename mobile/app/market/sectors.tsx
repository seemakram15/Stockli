import { View, FlatList, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { colors, useColors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { usePublicMarket } from "@/hooks/useMarket";
import { formatPercent, plColor } from "@/lib/format";

interface SectorRow {
  sector: string;
  changePct: number;
  count: number;
  advancers: number;
  decliners: number;
}

export default function SectorsScreen() {
  const c = useColors();
  const { data: marketData, isLoading } = usePublicMarket();

  const rawSectors: any[] = (marketData as any)?.data?.analytics?.sectors ?? [];
  const rows: SectorRow[] = rawSectors.map((s: any) => ({
    sector: s.sector,
    changePct: s.avgChangePct,
    count: s.count,
    advancers: s.advancers,
    decliners: s.decliners,
  }));

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-4">
        <Pressable onPress={() => router.back()} className="size-9 items-center justify-center">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <ThemedText variant="title">Sector Performance</ThemedText>
      </View>

      {isLoading && rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ThemedText variant="body" className="text-muted">No sector data available</ThemedText>
        </View>
      ) : (
        <FlatList
          data={[...rows].sort((a, b) => b.changePct - a.changePct)}
          keyExtractor={(item) => item.sector}
          renderItem={({ item }) => {
            const color = plColor(item.changePct);
            const barWidth = Math.min(Math.abs(item.changePct) * 5, 100);
            return (
              <View className="px-4 py-3 border-b border-border">
                <View className="flex-row items-center justify-between mb-1.5">
                  <ThemedText variant="body" className="flex-1 mr-2" numberOfLines={1}>
                    {item.sector}
                  </ThemedText>
                  <ThemedText variant="subhead" style={{ color }}>
                    {formatPercent(item.changePct)}
                  </ThemedText>
                </View>
                <View className="h-1.5 bg-border rounded-full overflow-hidden mb-1">
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </View>
                <ThemedText variant="caption" className="text-muted">
                  {item.count} stocks · {item.advancers} up · {item.decliners} down
                </ThemedText>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
        />
      )}
    </SafeAreaView>
  );
}
