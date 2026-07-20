import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, BriefcaseBusiness } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";

export default function PortfoliosScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between py-2">
          <ThemedText variant="title">Portfolios</ThemedText>
          <Pressable className="flex-row items-center gap-1.5 rounded-xl bg-accent px-3 py-2">
            <Plus size={15} color="#fff" />
            <Text className="text-[13px] font-bold text-white">New</Text>
          </Pressable>
        </View>

        {/* Empty state */}
        <Card className="items-center py-12 gap-4">
          <View className="size-16 items-center justify-center rounded-full bg-accent/10">
            <BriefcaseBusiness size={28} color={colors.accent} />
          </View>
          <View className="items-center gap-1">
            <ThemedText variant="subhead" className="text-text">No portfolios yet</ThemedText>
            <ThemedText variant="caption" className="text-center text-muted max-w-[220px]">
              Create your first portfolio to start tracking your PSX investments
            </ThemedText>
          </View>
          <Pressable className="mt-2 rounded-xl bg-accent px-6 py-3">
            <Text className="text-[15px] font-bold text-white">Create portfolio</Text>
          </Pressable>
        </Card>

        {/* Coming in Phase 1 note */}
        <Card className="border-accent/20 bg-accent/5">
          <ThemedText variant="label" className="mb-1 text-accent-text">Phase 1 — Coming next</ThemedText>
          <ThemedText variant="caption">Holdings table, live P/L, performance chart, add-trade dialog, transactions & dividends panels.</ThemedText>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
