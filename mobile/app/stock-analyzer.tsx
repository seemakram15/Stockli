import { useState } from "react";
import { View, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Search, ScanLine } from "lucide-react-native";
import useSWR from "swr";
import { colors, useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/format";

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 70 ? colors.gain : pct >= 40 ? colors.warn : colors.loss;
  return (
    <View className="h-2 bg-card2 rounded-full overflow-hidden">
      <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </View>
  );
}

function MetricRow({ label, value, comment }: { label: string; value: string; comment?: string }) {
  return (
    <View className="flex-row items-start justify-between py-2.5 border-b border-border">
      <View className="flex-1 pr-4">
        <ThemedText className="text-[13px] font-medium text-muted">{label}</ThemedText>
        {comment && <ThemedText variant="caption" className="mt-0.5" numberOfLines={2}>{comment}</ThemedText>}
      </View>
      <ThemedText className="text-[13px] font-semibold text-text">{value}</ThemedText>
    </View>
  );
}

export default function StockAnalyzerScreen() {
  const c = useColors();
  const [symbol, setSymbol] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isLoading, error } = useSWR(
    submitted ? `fundamentals:${submitted}` : null,
    () => api.market.stockFundamentals(submitted),
    { revalidateOnFocus: false }
  );

  const fund: any = (data as any)?.data ?? null;

  function handleSearch() {
    const s = symbol.trim().toUpperCase();
    if (s) setSubmitted(s);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Stock Analyzer</ThemedText>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-4"
        showsVerticalScrollIndicator={false}
      >
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
            <ScanLine size={18} color="#fff" />
          </Pressable>
        </View>

        {isLoading && (
          <View className="items-center py-16">
            <ActivityIndicator color={c.primary} size="large" />
            <ThemedText variant="caption" className="mt-3">Analyzing {submitted}…</ThemedText>
          </View>
        )}

        {error && (
          <Card className="items-center py-8 gap-2">
            <ThemedText variant="caption" className="text-loss">Failed to load: {error.message}</ThemedText>
          </Card>
        )}

        {fund && !isLoading && (
          <>
            {/* Score header */}
            {fund.score != null && (
              <Card className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <ThemedText variant="subhead" className="text-text font-bold text-[17px]">{submitted}</ThemedText>
                    <ThemedText variant="caption" className="mt-0.5">{fund.company ?? fund.name ?? ""}</ThemedText>
                  </View>
                  <View className="items-end">
                    <ThemedText
                      className="text-[28px] font-extrabold"
                      style={{ color: fund.score >= 7 ? colors.gain : fund.score >= 4 ? colors.warn : colors.loss }}
                    >
                      {fund.score.toFixed(1)}
                    </ThemedText>
                    <ThemedText variant="caption">/ 10</ThemedText>
                  </View>
                </View>
                <ScoreBar score={fund.score} />
                {fund.verdict && (
                  <ThemedText variant="caption" className="text-center mt-1">{fund.verdict}</ThemedText>
                )}
              </Card>
            )}

            {/* Valuation metrics */}
            <Card className="gap-0">
              <ThemedText variant="label" className="mb-2">Valuation</ThemedText>
              {fund.pe != null && <MetricRow label="P/E Ratio" value={fund.pe?.toFixed(2) ?? "—"} />}
              {fund.pb != null && <MetricRow label="P/B Ratio" value={fund.pb?.toFixed(2) ?? "—"} />}
              {fund.ps != null && <MetricRow label="P/S Ratio" value={fund.ps?.toFixed(2) ?? "—"} />}
              {fund.ev_ebitda != null && <MetricRow label="EV/EBITDA" value={fund.ev_ebitda?.toFixed(2) ?? "—"} />}
              {fund.dividend_yield != null && <MetricRow label="Dividend Yield" value={`${fund.dividend_yield?.toFixed(2)}%`} />}
            </Card>

            {/* Profitability */}
            <Card className="gap-0">
              <ThemedText variant="label" className="mb-2">Profitability</ThemedText>
              {fund.roe != null && <MetricRow label="ROE" value={`${fund.roe?.toFixed(2)}%`} />}
              {fund.roa != null && <MetricRow label="ROA" value={`${fund.roa?.toFixed(2)}%`} />}
              {fund.net_margin != null && <MetricRow label="Net Margin" value={`${fund.net_margin?.toFixed(2)}%`} />}
              {fund.gross_margin != null && <MetricRow label="Gross Margin" value={`${fund.gross_margin?.toFixed(2)}%`} />}
              {fund.eps != null && <MetricRow label="EPS" value={formatPKR(fund.eps)} />}
            </Card>

            {/* Strengths / Weaknesses */}
            {(fund.strengths?.length > 0 || fund.weaknesses?.length > 0) && (
              <Card className="gap-3">
                {fund.strengths?.length > 0 && (
                  <View className="gap-1">
                    <ThemedText variant="label" className="text-gain">Strengths</ThemedText>
                    {fund.strengths.map((s: string, i: number) => (
                      <ThemedText key={i} variant="caption" className="ml-2">• {s}</ThemedText>
                    ))}
                  </View>
                )}
                {fund.weaknesses?.length > 0 && (
                  <View className="gap-1">
                    <ThemedText variant="label" className="text-loss">Weaknesses</ThemedText>
                    {fund.weaknesses.map((w: string, i: number) => (
                      <ThemedText key={i} variant="caption" className="ml-2">• {w}</ThemedText>
                    ))}
                  </View>
                )}
              </Card>
            )}
          </>
        )}

        {!submitted && !isLoading && (
          <Card className="items-center py-12 gap-3">
            <ScanLine size={36} color={colors.muted} />
            <ThemedText variant="caption" className="text-center px-8">
              Enter a PSX symbol to get a fundamental analysis score
            </ThemedText>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
