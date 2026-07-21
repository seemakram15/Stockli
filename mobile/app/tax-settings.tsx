import { useState } from "react";
import { View, TextInput, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";

export default function TaxSettingsScreen() {
  const c = useColors();
  const [cgtRate, setCgtRate] = useState("15");
  const [filerStatus, setFilerStatus] = useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <ThemedText variant="title" style={{ flex: 1 }}>Tax Settings</ThemedText>
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        <ThemedText variant="caption" style={{ color: c.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 11, fontWeight: "700" }}>Capital Gains Tax (Pakistan)</ThemedText>

        <Card style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="body" style={{ fontWeight: "600" }}>Filer Status</ThemedText>
              <ThemedText variant="caption" style={{ color: c.muted, marginTop: 2 }}>Registered tax filer (lower CGT rate)</ThemedText>
            </View>
            <Switch value={filerStatus} onValueChange={setFilerStatus} trackColor={{ true: c.primary, false: c.border }} thumbColor="#fff" />
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16 }}>
            <ThemedText variant="caption" style={{ color: c.muted, marginBottom: 8 }}>CGT Rate (%)</ThemedText>
            <TextInput
              style={{
                backgroundColor: c.card2, borderWidth: 1, borderColor: c.border,
                borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                color: c.fg, fontSize: 16,
              }}
              value={cgtRate}
              onChangeText={setCgtRate}
              keyboardType="decimal-pad"
              placeholder="15"
              placeholderTextColor={c.muted}
            />
            <ThemedText variant="caption" style={{ color: c.muted, marginTop: 6 }}>
              Pakistan CGT: 15% for filers, 20% for non-filers on gains held &lt; 1 year
            </ThemedText>
          </View>
        </Card>

        <Card style={{ backgroundColor: c.primary + "12", borderColor: c.primary + "30" }}>
          <ThemedText variant="caption" style={{ color: c.primary, lineHeight: 20 }}>
            Tax rates as per FBR. Holdings &gt; 1 year: exempt for filers, 10% for non-filers. Holdings &lt; 1 year: 15% filers, 20% non-filers. Verify with your tax advisor.
          </ThemedText>
        </Card>
      </View>
    </SafeAreaView>
  );
}
