import { useState } from "react";
import { View, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, History, Search } from "lucide-react-native";
import useSWR from "swr";
import { useColors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";

export default function DividendHistoryScreen() {
  const c = useColors();
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useSWR(
    ["dividend-history", query || null],
    () => api.market.dividendHistory(query.trim().toUpperCase() || undefined),
    { revalidateOnFocus: false }
  );

  const rows: any[] = (data as any)?.data?.rows ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <ThemedText variant="title" style={{ flex: 1 }}>Dividend History</ThemedText>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: c.card2, borderWidth: 1, borderColor: c.border }}>
        <Search size={15} color={c.muted} />
        <TextInput
          style={{ flex: 1, color: c.fg, fontSize: 14 }}
          placeholder="Filter by symbol…"
          placeholderTextColor={c.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
        />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ThemedText variant="caption" style={{ color: c.muted }}>Failed to load</ThemedText>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, i) => `${item.symbol ?? i}-${i}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => item.symbol && router.push(`/stock/${item.symbol}` as never)}
              style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <ThemedText style={{ width: 80, fontSize: 13, fontWeight: "700", color: c.fg }}>{item.symbol ?? "—"}</ThemedText>
              <ThemedText variant="caption" style={{ flex: 1, color: c.muted }}>{item.payout ?? "—"}</ThemedText>
              <ThemedText variant="caption" style={{ color: c.muted }}>{item.creditedOn ?? "—"}</ThemedText>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 64, gap: 12 }}>
              <History size={36} color={c.muted} />
              <ThemedText variant="caption" style={{ color: c.muted }}>No dividend records</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
