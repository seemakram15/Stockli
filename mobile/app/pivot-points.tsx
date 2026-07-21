import { useState } from "react";
import { View, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Search, Target } from "lucide-react-native";
import useSWR from "swr";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/format";
import { usePublicMarket } from "@/hooks/useMarket";

interface PivotLevel {
  label: string;
  value: number;
  type: "resistance" | "support" | "pivot";
}

function computeClassicPivots(high: number, low: number, close: number): PivotLevel[] {
  const p = (high + low + close) / 3;
  const r1 = 2 * p - low;
  const r2 = p + (high - low);
  const r3 = high + 2 * (p - low);
  const s1 = 2 * p - high;
  const s2 = p - (high - low);
  const s3 = low - 2 * (high - p);
  return [
    { label: "R3", value: r3, type: "resistance" },
    { label: "R2", value: r2, type: "resistance" },
    { label: "R1", value: r1, type: "resistance" },
    { label: "Pivot", value: p, type: "pivot" },
    { label: "S1", value: s1, type: "support" },
    { label: "S2", value: s2, type: "support" },
    { label: "S3", value: s3, type: "support" },
  ];
}

export default function PivotPointsScreen() {
  const [symbol, setSymbol] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data: mktData } = usePublicMarket();

  function getStock(sym: string) {
    return ((mktData as any)?.stocks ?? []).find((s: any) => s.symbol === sym.toUpperCase());
  }

  const stock = submitted ? getStock(submitted) : null;
  const pivots = stock ? computeClassicPivots(stock.high ?? stock.current, stock.low ?? stock.current, stock.current) : [];

  function handleSearch() {
    setSubmitted(symbol.trim().toUpperCase());
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Pivot Points</ThemedText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <ThemedText variant="caption" className="text-muted">
          Classic pivot points from today's H/L/C
        </ThemedText>

        <View className="flex-row gap-2">
          <View className="flex-1 flex-row items-center gap-2 px-3 py-2.5 rounded-xl bg-surface border border-border">
            <Search size={15} color={colors.muted} />
            <TextInput
              className="flex-1 text-text text-[15px]"
              placeholder="Symbol (e.g. ENGRO)"
              placeholderTextColor={colors.muted}
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <Pressable
            onPress={handleSearch}
            className="px-4 py-2.5 rounded-xl bg-accent items-center justify-center"
          >
            <Target size={18} color="#fff" />
          </Pressable>
        </View>

        {submitted && !stock && (
          <Card className="items-center py-8 gap-2">
            <ThemedText variant="caption">Symbol not found: {submitted}</ThemedText>
          </Card>
        )}

        {stock && (
          <>
            <Card className="gap-3">
              <View className="flex-row justify-between">
                <ThemedText variant="subhead" className="text-text font-bold text-[17px]">{stock.symbol}</ThemedText>
                <ThemedText variant="subhead" className="text-text font-bold">{formatPKR(stock.current)}</ThemedText>
              </View>
              <View className="flex-row gap-4">
                <View>
                  <ThemedText variant="caption">High</ThemedText>
                  <ThemedText className="text-[13px] font-semibold text-gain">{formatPKR(stock.high ?? stock.current)}</ThemedText>
                </View>
                <View>
                  <ThemedText variant="caption">Low</ThemedText>
                  <ThemedText className="text-[13px] font-semibold text-loss">{formatPKR(stock.low ?? stock.current)}</ThemedText>
                </View>
                <View>
                  <ThemedText variant="caption">Close</ThemedText>
                  <ThemedText className="text-[13px] font-semibold text-text">{formatPKR(stock.current)}</ThemedText>
                </View>
              </View>
            </Card>

            <Card className="p-0 overflow-hidden">
              {pivots.map((level, i) => {
                const color = level.type === "resistance" ? colors.loss : level.type === "support" ? colors.gain : colors.accent;
                const isAbove = stock.current < level.value;
                return (
                  <View
                    key={level.label}
                    className={`flex-row items-center px-4 py-3.5 ${i < pivots.length - 1 ? "border-b border-border" : ""}`}
                    style={level.type === "pivot" ? { backgroundColor: colors.accent + "10" } : undefined}
                  >
                    <View className="w-14">
                      <ThemedText className="text-[13px] font-bold" style={{ color }}>{level.label}</ThemedText>
                    </View>
                    <ThemedText className="flex-1 text-[14px] font-semibold" style={{ color }}>
                      {formatPKR(level.value)}
                    </ThemedText>
                    <ThemedText variant="caption" className={isAbove ? "text-gain" : "text-loss"}>
                      {isAbove ? "▲" : "▼"} {Math.abs(((level.value - stock.current) / stock.current) * 100).toFixed(2)}%
                    </ThemedText>
                  </View>
                );
              })}
            </Card>
          </>
        )}

        {!submitted && (
          <Card className="items-center py-12 gap-3">
            <Target size={36} color={colors.muted} />
            <ThemedText variant="caption" className="text-center px-8">
              Enter a PSX symbol to calculate support & resistance levels
            </ThemedText>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
