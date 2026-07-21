import { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Target } from "lucide-react-native";
import { useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { StockSearchInput } from "@/components/ui/StockSearchInput";
import { type StockInfo } from "@/hooks/useStockCache";
import { formatPKR } from "@/lib/format";

export default function PivotPointsScreen() {
  const c = useColors();
  const [symbol, setSymbol] = useState("");
  const [selected, setSelected] = useState<StockInfo | null>(null);

  const stock = selected;

  const levels = stock ? [
    { label: "R3", value: stock.r3 ?? 0, type: "resistance" as const },
    { label: "R2", value: stock.r2 ?? 0, type: "resistance" as const },
    { label: "R1", value: stock.r1 ?? 0, type: "resistance" as const },
    { label: "Pivot", value: stock.pivot ?? 0, type: "pivot" as const },
    { label: "S1", value: stock.s1 ?? 0, type: "support" as const },
    { label: "S2", value: stock.s2 ?? 0, type: "support" as const },
    { label: "S3", value: stock.s3 ?? 0, type: "support" as const },
  ] : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <ThemedText variant="title" style={{ flex: 1 }}>Pivot Points</ThemedText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16, padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <StockSearchInput
          value={symbol}
          onChange={setSymbol}
          onSelect={(s) => setSelected(s)}
        />

        {!stock && (
          <Card style={{ alignItems: "center", paddingVertical: 48, gap: 12 }}>
            <Target size={36} color={c.muted} />
            <ThemedText variant="caption" style={{ color: c.muted, textAlign: "center" }}>
              Enter a PSX symbol to calculate support & resistance levels
            </ThemedText>
          </Card>
        )}

        {stock && (
          <>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <ThemedText variant="subhead" style={{ fontWeight: "800", fontSize: 17 }}>{stock.symbol}</ThemedText>
                  <ThemedText variant="caption" style={{ color: c.muted }}>{stock.name}</ThemedText>
                </View>
                <ThemedText variant="subhead" style={{ fontWeight: "700" }}>{formatPKR(stock.current ?? 0)}</ThemedText>
              </View>
              <View style={{ flexDirection: "row", gap: 20 }}>
                <View><ThemedText variant="caption" style={{ color: c.muted }}>High</ThemedText><ThemedText style={{ fontSize: 13, fontWeight: "600", color: c.gain }}>{formatPKR(stock.high ?? 0)}</ThemedText></View>
                <View><ThemedText variant="caption" style={{ color: c.muted }}>Low</ThemedText><ThemedText style={{ fontSize: 13, fontWeight: "600", color: c.loss }}>{formatPKR(stock.low ?? 0)}</ThemedText></View>
                <View><ThemedText variant="caption" style={{ color: c.muted }}>Prev Close</ThemedText><ThemedText style={{ fontSize: 13, fontWeight: "600", color: c.fg }}>{formatPKR(stock.previousClose ?? 0)}</ThemedText></View>
              </View>
            </Card>

            <Card style={{ padding: 0, overflow: "hidden" }}>
              {levels.map((level, i) => {
                const color = level.type === "resistance" ? c.loss : level.type === "support" ? c.gain : c.primary;
                const isAbove = (stock.current ?? 0) < level.value;
                const pctDiff = level.value && stock.current ? Math.abs(((level.value - stock.current) / stock.current) * 100).toFixed(2) : "0.00";
                return (
                  <View
                    key={level.label}
                    style={{
                      flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: i < levels.length - 1 ? 1 : 0, borderBottomColor: c.border,
                      backgroundColor: level.type === "pivot" ? c.primary + "12" : "transparent",
                    }}
                  >
                    <View style={{ width: 48 }}><ThemedText style={{ fontSize: 13, fontWeight: "700", color }}>{level.label}</ThemedText></View>
                    <ThemedText style={{ flex: 1, fontSize: 14, fontWeight: "600", color }}>{formatPKR(level.value)}</ThemedText>
                    <ThemedText variant="caption" style={{ color: isAbove ? c.gain : c.loss }}>
                      {isAbove ? "▲" : "▼"} {pctDiff}%
                    </ThemedText>
                  </View>
                );
              })}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
