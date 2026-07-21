import { View, FlatList, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, BookOpen } from "lucide-react-native";
import useSWR from "swr";
import { colors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/format";

export default function BookClosuresScreen() {
  const { data, isLoading, error } = useSWR("book-closures", api.market.bookClosures, {
    revalidateOnFocus: false,
  });

  const rows: any[] = (data as any)?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Book Closures</ThemedText>
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
          keyExtractor={(item, i) => `${item.symbol ?? i}-${i}`}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.symbol && router.push(`/stock/${item.symbol}` as never)}
              className="flex-row items-center gap-3 px-4 py-3.5 border-b border-border active:bg-surface"
            >
              <View className="size-9 items-center justify-center rounded-xl bg-orange/10">
                <BookOpen size={16} color={colors.orange} />
              </View>
              <View className="flex-1">
                <ThemedText className="text-[14px] font-semibold text-text">{item.symbol ?? "—"}</ThemedText>
                <ThemedText variant="caption" className="mt-0.5">{item.company ?? item.name ?? ""}</ThemedText>
              </View>
              <View className="items-end gap-0.5">
                {item.dividend != null && (
                  <ThemedText className="text-[12px] font-semibold text-gain">
                    {formatPKR(item.dividend)}
                  </ThemedText>
                )}
                <ThemedText variant="caption">{item.from_date ?? item.date ?? "—"}</ThemedText>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <BookOpen size={36} color={colors.muted} />
              <ThemedText variant="caption">No book closures</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
