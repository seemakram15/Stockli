import { View, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, ScanLine, Lightbulb, BarChart2, Target, Calendar, BookOpen, History, Link2, Youtube } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";

const DISCOVER_SECTIONS = [
  {
    label: "Analysis Tools",
    items: [
      { title: "Stock Analyzer", sub: "AI-scored fundamental analysis", icon: ScanLine, color: colors.accent },
      { title: "Portfolio Suggestions", sub: "AI-built PSX portfolio", icon: Lightbulb, color: colors.warn },
      { title: "Fundamentals", sub: "Compare P/E, P/B, ROE across all stocks", icon: BarChart2, color: colors.sky },
      { title: "Pivot Points", sub: "Support & resistance calculator", icon: Target, color: colors.gain },
    ],
  },
  {
    label: "Explore",
    items: [
      { title: "Board Meetings", sub: "Upcoming company meetings", icon: Calendar, color: colors.emerald },
      { title: "Book Closures", sub: "Dividend eligibility schedule", icon: BookOpen, color: colors.orange },
      { title: "Dividend History", sub: "Historical payouts", icon: History, color: colors.amber },
      { title: "Useful Links", sub: "PSX resources & tools", icon: Link2, color: colors.muted },
      { title: "YouTubers", sub: "Pakistani finance channels", icon: Youtube, color: colors.loss },
    ],
  },
];

export default function DiscoverScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="py-2">
          <ThemedText variant="title">Discover</ThemedText>
          <ThemedText variant="caption" className="mt-0.5">Tools, analysis & resources</ThemedText>
        </View>

        {DISCOVER_SECTIONS.map((section) => (
          <View key={section.label} className="gap-2">
            <ThemedText variant="label" className="ml-1">{section.label}</ThemedText>
            <Card className="p-0 overflow-hidden">
              {section.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.title}
                    onPress={() => {/* navigate */}}
                    className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-2 ${i < section.items.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <View className="size-9 items-center justify-center rounded-xl" style={{ backgroundColor: item.color + "20" }}>
                      <Icon size={16} color={item.color} />
                    </View>
                    <View className="flex-1">
                      <ThemedText variant="subhead" className="text-[15px] font-semibold text-text">{item.title}</ThemedText>
                      <ThemedText variant="caption" className="mt-0.5">{item.sub}</ThemedText>
                    </View>
                    <ChevronRight size={16} color={colors.muted} />
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
