import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight, ScanLine, BarChart2, Target, Calendar, BookOpen, History, Link2, Youtube } from "lucide-react-native";
import { useColors, type Colors } from "@/lib/theme";

type ColorKey = keyof Colors;

const DISCOVER_SECTIONS: { label: string; items: { title: string; sub: string; icon: any; colorKey: ColorKey; route: string }[] }[] = [
  {
    label: "Analysis Tools",
    items: [
      { title: "Stock Analyzer",  sub: "AI-scored fundamental analysis",            icon: ScanLine,  colorKey: "primary", route: "/stock-analyzer" },
      { title: "Fundamentals",    sub: "Compare P/E, P/B, ROE across all stocks",   icon: BarChart2, colorKey: "sky",     route: "/fundamentals" },
      { title: "Pivot Points",    sub: "Support & resistance calculator",            icon: Target,    colorKey: "gain",    route: "/pivot-points" },
    ],
  },
  {
    label: "Corporate Events",
    items: [
      { title: "Board Meetings",   sub: "Upcoming company board meetings",       icon: Calendar, colorKey: "emerald", route: "/board-meetings" },
      { title: "Book Closures",    sub: "Dividend eligibility schedule",         icon: BookOpen, colorKey: "orange",  route: "/book-closures" },
      { title: "Dividend History", sub: "Historical dividend payouts by stock",  icon: History,  colorKey: "amber",   route: "/dividend-history" },
    ],
  },
  {
    label: "Resources",
    items: [
      { title: "Useful Links",  sub: "PSX resources, tools & regulators", icon: Link2,   colorKey: "muted", route: "/useful-links" },
      { title: "YouTubers",     sub: "Top Pakistani finance channels",     icon: Youtube, colorKey: "loss",  route: "/youtubers" },
    ],
  },
];

export default function DiscoverScreen() {
  const c = useColors();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: c.fg, letterSpacing: -0.8 }}>Discover</Text>
          <Text style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>Tools, analysis & market resources</Text>
        </View>

        {DISCOVER_SECTIONS.map((section) => (
          <View key={section.label} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted, letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 20, marginBottom: 8 }}>
              {section.label}
            </Text>
            <View style={{ marginHorizontal: 20, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
              {section.items.map((item, i) => {
                const Icon = item.icon;
                const color = c[item.colorKey] as string;
                return (
                  <Pressable
                    key={item.title}
                    onPress={() => router.push(item.route as never)}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
                      borderBottomWidth: i < section.items.length - 1 ? 1 : 0,
                      borderBottomColor: c.border,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + "20", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={17} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: c.fg }}>{item.title}</Text>
                      <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{item.sub}</Text>
                    </View>
                    <ChevronRight size={16} color={c.muted} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
