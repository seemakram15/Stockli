import { useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, BarChart2 } from "lucide-react-native";
import { useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { StockSearchInput } from "@/components/ui/StockSearchInput";
import { type StockInfo } from "@/hooks/useStockCache";
import { formatPKR } from "@/lib/format";

function StatRow({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <ThemedText variant="caption" style={{ color: c.muted }}>{label}</ThemedText>
      <View style={{ alignItems: "flex-end" }}>
        <ThemedText variant="caption" style={{ fontWeight: "600", color: c.fg }}>{value}</ThemedText>
        {subValue ? <ThemedText variant="caption" style={{ color: c.muted, fontSize: 10 }}>{subValue}</ThemedText> : null}
      </View>
    </View>
  );
}

export default function FundamentalsScreen() {
  const c = useColors();
  const [symbol, setSymbol] = useState("");
  const [selected, setSelected] = useState<StockInfo | null>(null);

  const stock = selected;
  const range = stock && stock.high && stock.low ? stock.high - stock.low : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <ThemedText variant="title" style={{ flex: 1 }}>Fundamentals</ThemedText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <StockSearchInput
          value={symbol}
          onChange={setSymbol}
          onSelect={(s) => setSelected(s)}
        />

        {!stock && (
          <Card style={{ alignItems: "center", paddingVertical: 48, gap: 12 }}>
            <BarChart2 size={36} color={c.muted} />
            <ThemedText variant="caption" style={{ color: c.muted, textAlign: "center" }}>
              Enter a PSX symbol to view market data and pivot levels
            </ThemedText>
          </Card>
        )}

        {stock && (
          <>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View>
                  <ThemedText variant="subhead" style={{ fontWeight: "800", fontSize: 17 }}>{stock.symbol}</ThemedText>
                  <ThemedText variant="caption" style={{ color: c.muted, marginTop: 2 }}>{stock.name}</ThemedText>
                  {stock.sector ? <ThemedText variant="caption" style={{ color: c.primary, marginTop: 2 }}>{stock.sector}</ThemedText> : null}
                </View>
                <ThemedText variant="subhead" style={{ fontWeight: "700", fontSize: 20 }}>{formatPKR(stock.current ?? 0)}</ThemedText>
              </View>

              {range > 0 && (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <ThemedText variant="caption" style={{ color: c.loss }}>{formatPKR(stock.low ?? 0)}</ThemedText>
                    <ThemedText variant="caption" style={{ color: c.muted }}>Day Range</ThemedText>
                    <ThemedText variant="caption" style={{ color: c.gain }}>{formatPKR(stock.high ?? 0)}</ThemedText>
                  </View>
                  <View style={{ height: 6, backgroundColor: c.border, borderRadius: 3, overflow: "hidden" }}>
                    {stock.low && stock.high && stock.current ? (
                      <View style={{
                        position: "absolute", left: `${Math.max(0, ((stock.current - stock.low) / (stock.high - stock.low)) * 100 - 2)}%`,
                        width: 4, height: 6, backgroundColor: c.primary, borderRadius: 2,
                      }} />
                    ) : null}
                    <View style={{ height: "100%", backgroundColor: c.primary + "30", borderRadius: 3 }} />
                  </View>
                </View>
              )}
            </Card>

            <Card style={{ padding: 0 }}>
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <ThemedText variant="label" style={{ fontWeight: "700" }}>Price Levels</ThemedText>
              </View>
              <View style={{ padding: 16, gap: 0 }}>
                <StatRow label="Previous Close" value={formatPKR(stock.previousClose ?? 0)} />
                <StatRow label="Today High" value={formatPKR(stock.high ?? 0)} />
                <StatRow label="Today Low" value={formatPKR(stock.low ?? 0)} />
                <StatRow label="Range" value={formatPKR(range)} subValue={stock.high && stock.low && stock.previousClose ? `${((range / stock.previousClose) * 100).toFixed(2)}% of close` : undefined} />
              </View>
            </Card>

            {stock.pivot && (
              <Card style={{ padding: 0 }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: c.border }}>
                  <ThemedText variant="label" style={{ fontWeight: "700" }}>Classic Pivot Points</ThemedText>
                </View>
                <View style={{ padding: 16 }}>
                  {[
                    { label: "R3", value: stock.r3, color: c.loss },
                    { label: "R2", value: stock.r2, color: c.loss },
                    { label: "R1", value: stock.r1, color: c.loss },
                    { label: "Pivot", value: stock.pivot, color: c.primary },
                    { label: "S1", value: stock.s1, color: c.gain },
                    { label: "S2", value: stock.s2, color: c.gain },
                    { label: "S3", value: stock.s3, color: c.gain },
                  ].map((l, i) => l.value != null && (
                    <View key={l.label} style={{
                      flexDirection: "row", alignItems: "center", paddingVertical: 8,
                      borderBottomWidth: i < 6 ? 1 : 0, borderBottomColor: c.border,
                    }}>
                      <ThemedText style={{ width: 44, fontSize: 12, fontWeight: "700", color: l.color }}>{l.label}</ThemedText>
                      <ThemedText style={{ flex: 1, fontSize: 13, fontWeight: "600", color: l.color }}>{formatPKR(l.value)}</ThemedText>
                      <ThemedText variant="caption" style={{ color: (stock.current ?? 0) < l.value ? c.gain : c.loss }}>
                        {(stock.current ?? 0) < l.value ? "▲" : "▼"} {stock.current ? Math.abs(((l.value - stock.current) / stock.current) * 100).toFixed(2) : "0.00"}%
                      </ThemedText>
                    </View>
                  ))}
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
