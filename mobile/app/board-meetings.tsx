import { View, FlatList, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Calendar } from "lucide-react-native";
import useSWR from "swr";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";

export default function BoardMeetingsScreen() {
  const { data, isLoading, error } = useSWR("board-meetings", api.market.boardMeetings, {
    revalidateOnFocus: false,
  });

  const rows: any[] = (data as any)?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Board Meetings</ThemedText>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <ThemedText variant="caption" className="text-center text-muted">Failed to load</ThemedText>
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
              <View className="size-9 items-center justify-center rounded-xl bg-accent/10">
                <Calendar size={16} color={colors.accent} />
              </View>
              <View className="flex-1">
                <ThemedText className="text-[14px] font-semibold text-text">{item.symbol ?? item.company ?? "—"}</ThemedText>
                <ThemedText variant="caption" className="mt-0.5">
                  {item.company ?? item.name ?? ""}
                </ThemedText>
              </View>
              <ThemedText variant="caption" className="text-right">
                {item.date ?? item.meeting_date ?? "—"}
              </ThemedText>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <Calendar size={36} color={colors.muted} />
              <ThemedText variant="caption">No upcoming meetings</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
