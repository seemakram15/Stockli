import { useState } from "react";
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ScanLine } from "lucide-react-native";
import useSWR from "swr";
import { useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { StockSearchInput } from "@/components/ui/StockSearchInput";

const BASE = process.env.EXPO_PUBLIC_SITE_URL ?? "";
const MOBILE_UA = "StockliApp/1.0 (Mobile; React-Native)";

function fetchAllSnapshots() {
  return fetch(`${BASE}/api/public/stock-fundamentals/snapshots?offset=0&limit=500`, {
    headers: { "User-Agent": MOBILE_UA },
  }).then((r) => r.json());
}

function ScoreGauge({ score, max = 10 }: { score: number; max?: number }) {
  const c = useColors();
  const pct = Math.min(100, (score / max) * 100);
  const color = pct >= 70 ? c.gain : pct >= 40 ? c.warn : c.loss;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 10, backgroundColor: c.border, borderRadius: 999, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, backgroundColor: color, borderRadius: 999 }} />
      </View>
    </View>
  );
}

function HighlightRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const c = useColors();
  const textColor = tone === "positive" ? c.gain : tone === "negative" ? c.loss : c.fg;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <ThemedText variant="caption" style={{ color: c.muted, flex: 1 }}>{label}</ThemedText>
      <ThemedText variant="caption" style={{ color: textColor, fontWeight: "600" }}>{value}</ThemedText>
    </View>
  );
}

export default function StockAnalyzerScreen() {
  const c = useColors();
  const [symbol, setSymbol] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");

  const { data: snapshotData, isLoading } = useSWR(
    "stock-snapshots",
    fetchAllSnapshots,
    { revalidateOnFocus: false }
  );

  const records: any[] = snapshotData?.data?.records ?? [];
  const found = selectedSymbol ? records.find((r: any) => r.symbol === selectedSymbol) : null;
  const tabs = found?.data?.tabs ?? {};
  const overview = tabs.overview ?? {};
  const highlights: any[] = overview.highlights ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <ThemedText variant="title" style={{ flex: 1 }}>Stock Analyzer</ThemedText>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <StockSearchInput
          value={symbol}
          onChange={setSymbol}
          onSelect={(s) => setSelectedSymbol(s.symbol)}
        />

        {isLoading && !found && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color={c.primary} />
            <ThemedText variant="caption" style={{ marginTop: 8, color: c.muted }}>Loading stock data…</ThemedText>
          </View>
        )}

        {!selectedSymbol && !isLoading && (
          <Card style={{ alignItems: "center", paddingVertical: 48, gap: 12 }}>
            <ScanLine size={36} color={c.muted} />
            <ThemedText variant="caption" style={{ color: c.muted, textAlign: "center" }}>
              Enter a PSX symbol to get a fundamental analysis
            </ThemedText>
          </Card>
        )}

        {selectedSymbol && !found && !isLoading && (
          <Card style={{ alignItems: "center", paddingVertical: 32 }}>
            <ThemedText variant="caption" style={{ color: c.muted }}>No data available for {selectedSymbol}</ThemedText>
          </Card>
        )}

        {found && !isLoading && (
          <>
            <Card style={{ gap: 12 }}>
              <ThemedText variant="subhead" style={{ fontWeight: "800", fontSize: 17 }}>{found.symbol}</ThemedText>
              {found.data?.company?.name && (
                <ThemedText variant="caption" style={{ color: c.muted, marginTop: -8 }}>{found.data.company.name}</ThemedText>
              )}
              {highlights.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  {highlights.map((h: any, i: number) => (
                    <HighlightRow key={i} label={h.label} value={h.value} tone={h.tone} />
                  ))}
                </View>
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
