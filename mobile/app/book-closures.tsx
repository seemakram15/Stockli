import { View, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, BookOpen } from "lucide-react-native";
import useSWR from "swr";
import { useColors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";

export default function BookClosuresScreen() {
  const c = useColors();
  const { data, isLoading, error } = useSWR("book-closures", api.market.bookClosures, {
    revalidateOnFocus: false,
  });

  const rows: any[] = (data as any)?.data?.rows ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <ThemedText variant="title" style={{ flex: 1 }}>Book Closures</ThemedText>
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
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: c.warn + "18" }}>
                <BookOpen size={16} color={c.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: "600", color: c.fg }}>{item.symbol ?? "—"}</ThemedText>
                <ThemedText variant="caption" style={{ color: c.muted, marginTop: 1 }}>{item.company ?? ""}</ThemedText>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <ThemedText style={{ fontSize: 12, fontWeight: "600", color: c.gain }}>{item.payout ?? "—"}</ThemedText>
                <ThemedText variant="caption" style={{ color: c.muted }}>{item.bookClosureFrom ?? "—"}</ThemedText>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 64, gap: 12 }}>
              <BookOpen size={36} color={c.muted} />
              <ThemedText variant="caption" style={{ color: c.muted }}>No book closures</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
