import { useState } from "react";
import { View, FlatList, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Search } from "lucide-react-native";
import useSWR from "swr";
import { colors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";
import { usePublicMarket } from "@/hooks/useMarket";

interface FundRow {
  symbol: string;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  eps: number | null;
  sector: string | null;
}

function cell(val: number | null, suffix = "") {
  if (val == null || isNaN(val)) return "—";
  return val.toFixed(2) + suffix;
}

function colorFor(val: number | null, low: number, high: number) {
  if (val == null) return colors.muted;
  if (val <= low) return colors.gain;
  if (val >= high) return colors.loss;
  return colors.text;
}

export default function FundamentalsScreen() {
  const { data: mktData, isLoading: mktLoading } = usePublicMarket();
  const [query, setQuery] = useState("");

  const stocks: FundRow[] = ((mktData as any)?.stocks ?? []).map((s: any) => ({
    symbol: s.symbol,
    pe: s.pe ?? null,
    pb: s.pb ?? null,
    roe: s.roe ?? null,
    eps: s.eps ?? null,
    sector: s.sector ?? null,
  }));

  const filtered = stocks.filter((s) => {
    if (!query) return true;
    const q = query.toUpperCase();
    return s.symbol.includes(q) || (s.sector ?? "").toUpperCase().includes(q);
  });

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Fundamentals</ThemedText>
      </View>

      <View className="flex-row items-center gap-2 mx-4 my-3 px-3 py-2.5 rounded-xl bg-surface border border-border">
        <Search size={15} color={colors.muted} />
        <TextInput
          className="flex-1 text-text text-[14px]"
          placeholder="Filter by symbol or sector…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
        />
      </View>

      {/* Header row */}
      <View className="flex-row px-4 pb-2 border-b border-border">
        <ThemedText variant="caption" className="w-20">Symbol</ThemedText>
        <ThemedText variant="caption" className="flex-1 text-right">P/E</ThemedText>
        <ThemedText variant="caption" className="flex-1 text-right">P/B</ThemedText>
        <ThemedText variant="caption" className="flex-1 text-right">ROE%</ThemedText>
        <ThemedText variant="caption" className="flex-1 text-right">EPS</ThemedText>
      </View>

      {mktLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.symbol}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/stock/${item.symbol}` as never)}
              className="flex-row items-center px-4 py-3 border-b border-border active:bg-surface"
            >
              <ThemedText className="w-20 text-[13px] font-semibold text-text">{item.symbol}</ThemedText>
              <ThemedText className="flex-1 text-right text-[13px]" style={{ color: colorFor(item.pe, 5, 30) }}>
                {cell(item.pe)}
              </ThemedText>
              <ThemedText className="flex-1 text-right text-[13px]" style={{ color: colorFor(item.pb, 0.5, 5) }}>
                {cell(item.pb)}
              </ThemedText>
              <ThemedText className="flex-1 text-right text-[13px]" style={{ color: colorFor(item.roe, 5, 20) }}>
                {cell(item.roe, "%")}
              </ThemedText>
              <ThemedText className="flex-1 text-right text-[13px] text-muted">
                {cell(item.eps)}
              </ThemedText>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <ThemedText variant="caption">No data</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
