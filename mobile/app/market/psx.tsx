import { useState } from "react";
import { View, FlatList, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import { colors, useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { usePublicMarket } from "@/hooks/useMarket";
import { formatPKR, formatPercent, formatCompact, plColor } from "@/lib/format";

interface MarketRow {
  symbol: string;
  company_name?: string;
  current: number;
  change: number;
  changePct: number;
  volume?: number | null;
}

function MarketRow({ item }: { item: MarketRow }) {
  const color = plColor(item.changePct);
  return (
    <Pressable
      className="flex-row items-center px-4 py-3 border-b border-border active:opacity-70"
      onPress={() => router.push(`/stock/${item.symbol}`)}
    >
      <View className="flex-1">
        <ThemedText variant="body">{item.symbol}</ThemedText>
        {item.company_name ? (
          <ThemedText variant="caption" className="text-muted" numberOfLines={1}>
            {item.company_name}
          </ThemedText>
        ) : null}
      </View>
      <View className="items-end mr-4">
        <ThemedText variant="body" className="text-fg">{formatPKR(item.current)}</ThemedText>
        {item.volume ? (
          <ThemedText variant="caption" className="text-muted">{formatCompact(item.volume)}</ThemedText>
        ) : null}
      </View>
      <View className="items-end w-20">
        <ThemedText variant="body" style={{ color }}>
          {item.changePct >= 0 ? "+" : ""}{formatPercent(item.changePct)}
        </ThemedText>
        <ThemedText variant="caption" style={{ color }}>
          {item.change >= 0 ? "+" : ""}{formatPKR(item.change)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

type SortKey = "symbol" | "change" | "volume";

export default function PsxMarketScreen() {
  const c = useColors();
  const { data: marketData, isLoading } = usePublicMarket();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("change");

  const rows: MarketRow[] = (marketData as { data?: { rows?: MarketRow[] } } | undefined)?.data?.rows ?? [];

  const filtered = rows
    .filter((r) => {
      const q = query.trim().toUpperCase();
      return !q || r.symbol.includes(q) || r.company_name?.toUpperCase().includes(q);
    })
    .sort((a, b) =>
      sort === "symbol"
        ? a.symbol.localeCompare(b.symbol)
        : sort === "volume"
        ? (b.volume ?? 0) - (a.volume ?? 0)
        : Math.abs(b.changePct) - Math.abs(a.changePct)
    );

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "change", label: "Movers" },
    { key: "volume", label: "Volume" },
    { key: "symbol", label: "A–Z" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="size-9 items-center justify-center">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">PSX Market</ThemedText>
      </View>

      {/* Search + Sort */}
      <View className="px-4 pb-3 gap-3">
        <View className="flex-row items-center gap-2 rounded-xl bg-surface border border-border px-3 py-2.5">
          <Search size={16} color={colors.muted} />
          <TextInput
            className="flex-1 text-fg text-[15px]"
            placeholder="Search symbol or company…"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
          />
        </View>
        <View className="flex-row gap-2">
          {SORTS.map((s) => (
            <Pressable
              key={s.key}
              className={`px-3 py-1.5 rounded-full border ${
                sort === s.key ? "bg-accent border-accent" : "border-border"
              }`}
              onPress={() => setSort(s.key)}
            >
              <ThemedText
                variant="caption"
                style={{ color: sort === s.key ? "#fff" : colors.muted }}
              >
                {s.label}
              </ThemedText>
            </Pressable>
          ))}
          <ThemedText variant="caption" className="text-muted self-center ml-auto">
            {filtered.length} stocks
          </ThemedText>
        </View>
      </View>

      {/* Column headers */}
      <View className="flex-row items-center px-4 py-1.5 border-b border-border">
        <ThemedText variant="caption" className="text-muted flex-1">Symbol</ThemedText>
        <ThemedText variant="caption" className="text-muted mr-4">Price</ThemedText>
        <ThemedText variant="caption" className="text-muted w-20 text-right">Change</ThemedText>
      </View>

      {isLoading && filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.symbol}
          renderItem={({ item }) => <MarketRow item={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
          initialNumToRender={20}
          maxToRenderPerBatch={30}
        />
      )}
    </SafeAreaView>
  );
}
