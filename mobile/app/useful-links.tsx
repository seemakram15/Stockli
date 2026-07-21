import { View, FlatList, ActivityIndicator, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Link2, ExternalLink } from "lucide-react-native";
import useSWR from "swr";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";

export default function UsefulLinksScreen() {
  const { data, isLoading, error } = useSWR("useful-links", api.market.usefulLinks, {
    revalidateOnFocus: false,
  });

  const rows: any[] = (data as any)?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Useful Links</ThemedText>
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
          keyExtractor={(item, i) => item.url ?? `${i}`}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.url && Linking.openURL(item.url)}
              className="flex-row items-center gap-3 px-4 py-3.5 border-b border-border active:bg-surface"
            >
              <View className="size-9 items-center justify-center rounded-xl bg-muted/10">
                <Link2 size={16} color={colors.muted} />
              </View>
              <View className="flex-1">
                <ThemedText className="text-[14px] font-semibold text-text">{item.title ?? item.name ?? item.url}</ThemedText>
                {item.description && (
                  <ThemedText variant="caption" className="mt-0.5" numberOfLines={1}>{item.description}</ThemedText>
                )}
              </View>
              <ExternalLink size={14} color={colors.muted} />
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center py-16 gap-3">
              <Link2 size={36} color={colors.muted} />
              <ThemedText variant="caption">No links available</ThemedText>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
