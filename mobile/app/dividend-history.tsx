import { useState } from "react";
import { View, FlatList, ActivityIndicator, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, History, Search } from "lucide-react-native";
import useSWR from "swr";
import { colors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/format";

export default function DividendHistoryScreen() {
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useSWR(
    ["dividend-history", query || null],
    () => api.market.dividendHistory(query.trim().toUpperCase() || undefined),
    { revalidateOnFocus: false }
  );

  const rows: any[] = (data as any)?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Dividend History</ThemedText>
      </View>

      <View className="flex-row items-center gap-2 mx-4 my-3 px-3 py-2.5 rounded-xl bg-surface border border-border">
        <Search size={15} color={colors.muted} />
        <TextInput
          className="flex-1 text-text text-[14px]"
          placeholder="Filter by symbol…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center">
          <ThemedText variant="caption" className="text-muted">Failed to load</ThemedText>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => `${item.symbol ?? i}-${i}-${item.year ?? ""}`}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.symbol && router.push(`/stock/${item.symbol}` as never)}
              className="flex-row items-center px-4 py-3 border-b border-border active:bg-surface"
            >
              <ThemedText className="w-20 text-[13px] font-semibold text-text">{item.symbol ?? "—"}</ThemedText>
              <View className="flex-1">
                <ThemedText variant="caption">{item.year ?? item.date ?? "—"}</ThemedText>
                {item.type && <ThemedText variant="caption" className="mt-0.5">{item.type}</ThemedText>}
              </View>
              <View className="items-end">
                {item.cash != null && (
                  <ThemedText className="text-[13px] font-semibold text-gain">{formatPKR(item.cash)}</ThemedText>
                )}
                {item.bonus != null && item.bonus > 0 && (
                  <ThemedText variant="caption" className="text-sky">Bonus {item.bonus}%</ThemedText>
                )}
                {item.right != null && item.right > 0 && (
                  <ThemedText variant="caption" className="text-amber">Rights {item.right}%</ThemedText>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <History size={36} color={colors.muted} />
              <ThemedText variant="caption">No dividend records</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
