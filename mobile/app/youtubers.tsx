import { View, FlatList, ActivityIndicator, Pressable, Linking, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Youtube, ExternalLink } from "lucide-react-native";
import useSWR from "swr";
import { colors } from "@/lib/theme";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";

export default function YouTubersScreen() {
  const { data, isLoading, error } = useSWR("youtubers", api.market.youtubers, {
    revalidateOnFocus: false,
  });

  const rows: any[] = (data as any)?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">YouTubers</ThemedText>
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
          keyExtractor={(item, i) => item.url ?? item.channel ?? `${i}`}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.url && Linking.openURL(item.url)}
              className="flex-row items-center gap-3 px-4 py-3.5 border-b border-border active:bg-surface"
            >
              <View className="size-10 items-center justify-center rounded-full bg-loss/15">
                <Youtube size={18} color={colors.loss} />
              </View>
              <View className="flex-1">
                <ThemedText className="text-[14px] font-semibold text-text">{item.name ?? item.channel ?? "—"}</ThemedText>
                {item.description && (
                  <ThemedText variant="caption" className="mt-0.5" numberOfLines={2}>{item.description}</ThemedText>
                )}
                {item.subscribers && (
                  <ThemedText variant="caption" className="mt-0.5 text-muted">{item.subscribers} subscribers</ThemedText>
                )}
              </View>
              <ExternalLink size={14} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <Youtube size={36} color={colors.muted} />
              <ThemedText variant="caption">No channels listed</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
