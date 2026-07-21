import { useState } from "react";
import { View, FlatList, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Search } from "lucide-react-native";
import useSWR from "swr";
import { colors, useColors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";
import { formatPercent, plColor } from "@/lib/format";

interface MufapFund {
  fund_name: string;
  amc: string;
  category: string;
  nav: number;
  return_1m?: number;
  return_3m?: number;
  return_1y?: number;
}

export default function MutualFundsScreen() {
  const c = useColors();
  const { data, isLoading } = useSWR("mufap", api.market.mufap, { revalidateOnFocus: false });
  const [query, setQuery] = useState("");

  const funds: MufapFund[] = (data as { data?: { funds?: MufapFund[] } } | undefined)?.data?.funds ?? [];

  const filtered = funds.filter((f) => {
    const q = query.trim().toLowerCase();
    return !q || f.fund_name.toLowerCase().includes(q) || f.amc.toLowerCase().includes(q);
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="size-9 items-center justify-center">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <ThemedText variant="title">Mutual Funds</ThemedText>
      </View>

      <View className="px-4 pb-3">
        <View className="flex-row items-center gap-2 rounded-xl bg-surface border border-border px-3 py-2.5">
          <Search size={16} color={colors.muted} />
          <TextInput
            className="flex-1 text-fg text-[15px]"
            placeholder="Search fund or AMC…"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Column headers */}
      <View className="flex-row items-center px-4 py-1.5 border-b border-border">
        <ThemedText variant="caption" className="text-muted flex-1">Fund</ThemedText>
        <ThemedText variant="caption" className="text-muted w-16 text-right">1M</ThemedText>
        <ThemedText variant="caption" className="text-muted w-16 text-right">1Y</ThemedText>
      </View>

      {isLoading && filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.fund_name}
          renderItem={({ item }) => (
            <View className="flex-row items-center px-4 py-3 border-b border-border">
              <View className="flex-1 mr-2">
                <ThemedText variant="body" numberOfLines={1}>{item.fund_name}</ThemedText>
                <ThemedText variant="caption" className="text-muted">{item.amc} · {item.category}</ThemedText>
              </View>
              <ThemedText
                variant="caption"
                className="w-16 text-right"
                style={{ color: item.return_1m != null ? plColor(item.return_1m) : colors.muted }}
              >
                {item.return_1m != null ? `${formatPercent(item.return_1m)}` : "—"}
              </ThemedText>
              <ThemedText
                variant="caption"
                className="w-16 text-right"
                style={{ color: item.return_1y != null ? plColor(item.return_1y) : colors.muted }}
              >
                {item.return_1y != null ? `${formatPercent(item.return_1y)}` : "—"}
              </ThemedText>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
          initialNumToRender={25}
        />
      )}
    </SafeAreaView>
  );
}
