import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import useSWR from "swr";
import { colors, useColors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";
import { formatPercent, plColor } from "@/lib/format";

const SLUG_CONFIG: Record<string, { title: string; fetcher: () => Promise<unknown> }> = {
  us: { title: "USA · S&P 500", fetcher: api.market.globalMarket },
  india: { title: "India", fetcher: api.market.globalMarket },
  world: { title: "World Markets", fetcher: api.market.globalMarket },
  commodities: { title: "Commodities", fetcher: api.market.globalMarket },
  oil: { title: "Oil & Energy", fetcher: api.market.globalMarket },
  crypto: { title: "Crypto", fetcher: api.market.globalMarket },
};

interface GlobalRow {
  symbol: string;
  name?: string;
  current?: number;
  price?: number;
  changePct?: number;
  region?: string;
  type?: string;
}

export default function MarketSlugScreen() {
  const c = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const cfg = SLUG_CONFIG[slug] ?? { title: slug, fetcher: api.market.globalMarket };

  const { data, isLoading } = useSWR(`market:${slug}`, cfg.fetcher, { revalidateOnFocus: false });

  const allRows: GlobalRow[] = (data as { data?: { rows?: GlobalRow[] } } | undefined)?.data?.rows ?? [];

  const slugFilter: Record<string, (r: GlobalRow) => boolean> = {
    us: (r) => r.region === "US" || r.type === "index",
    india: (r) => r.region === "IN",
    world: (r) => r.type === "index",
    commodities: (r) => r.type === "commodity",
    oil: (r) => r.type === "energy" || r.type === "oil",
    crypto: (r) => r.type === "crypto",
  };

  const rows = slug && slugFilter[slug] ? allRows.filter(slugFilter[slug]) : allRows;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-4">
        <Pressable onPress={() => router.back()} className="size-9 items-center justify-center">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <ThemedText variant="title">{cfg.title}</ThemedText>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ThemedText variant="body" className="text-muted">No data available</ThemedText>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
          {rows.map((row, i) => {
            const price = row.current ?? row.price ?? 0;
            const changePct = row.changePct ?? 0;
            const color = plColor(changePct);
            return (
              <View key={`${row.symbol}-${i}`} className="flex-row items-center px-4 py-3 border-b border-border">
                <View className="flex-1">
                  <ThemedText variant="body">{row.symbol}</ThemedText>
                  {row.name ? <ThemedText variant="caption" className="text-muted" numberOfLines={1}>{row.name}</ThemedText> : null}
                </View>
                <View className="items-end">
                  <ThemedText variant="body" className="text-fg">{price.toLocaleString()}</ThemedText>
                  <ThemedText variant="caption" style={{ color }}>
                    {changePct >= 0 ? "+" : ""}{formatPercent(changePct)}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
