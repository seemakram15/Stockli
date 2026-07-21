import { View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Sun, Moon, Smartphone } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";

const OPTIONS = [
  { key: "light" as const, label: "Light", sub: "Always use light theme", icon: Sun },
  { key: "dark" as const, label: "Dark", sub: "Always use dark theme", icon: Moon },
  { key: "system" as const, label: "System", sub: "Follow device setting", icon: Smartphone },
];

export default function AppearanceScreen() {
  const c = useColors();
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <ThemedText variant="title" style={{ flex: 1 }}>Appearance</ThemedText>
      </View>

      <View style={{ padding: 16, gap: 8 }}>
        <ThemedText variant="caption" style={{ color: c.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontSize: 11, fontWeight: "700" }}>Theme</ThemedText>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {OPTIONS.map((opt, i) => {
            const Icon = opt.icon;
            const active = colorScheme === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                activeOpacity={0.7}
                onPress={() => setColorScheme(opt.key)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
                  borderBottomWidth: i < OPTIONS.length - 1 ? 1 : 0, borderBottomColor: c.border,
                  backgroundColor: active ? c.primary + "12" : "transparent",
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: active ? c.primary + "25" : c.border, alignItems: "center", justifyContent: "center" }}>
                  <Icon size={18} color={active ? c.primary : c.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="body" style={{ fontWeight: active ? "700" : "500", color: c.fg }}>{opt.label}</ThemedText>
                  <ThemedText variant="caption" style={{ color: c.muted, marginTop: 2 }}>{opt.sub}</ThemedText>
                </View>
                {active && (
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}>
                    <ThemedText style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>✓</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </Card>
      </View>
    </SafeAreaView>
  );
}
