import { useState } from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react-native";
import useSWR from "swr";
import { colors, useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { usePrices } from "@/hooks/useMarket";
import { useHoldings, usePortfolios } from "@/hooks/usePortfolio";
import { formatPKR, formatPercent, formatCompact, plColor } from "@/lib/format";

const BASE = process.env.EXPO_PUBLIC_SITE_URL ?? "";

function fetchDividends(symbol: string) {
  return fetch(`${BASE}/api/public/dividend-history?symbol=${symbol}`)
    .then((r) => r.json())
    .catch(() => null);
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-border">
      <ThemedText variant="caption" className="text-muted">{label}</ThemedText>
      <ThemedText variant="caption" className="text-fg">{value}</ThemedText>
    </View>
  );
}

type TabId = "overview" | "positions" | "dividends";

export default function StockDetailScreen() {
  const c = useColors();
  const { symbol: rawSymbol } = useLocalSearchParams<{ symbol: string }>();
  const symbol = rawSymbol?.toUpperCase() ?? "";
  const [tab, setTab] = useState<TabId>("overview");

  const { data: quotes = [] } = usePrices([symbol]);
  const { data: dividendData } = useSWR(
    symbol ? `dividends:${symbol}` : null,
    () => fetchDividends(symbol),
    { revalidateOnFocus: false }
  );

  const { data: portfolios = [] } = usePortfolios();
  const allPortfolioIds = portfolios.map((p) => p.id);

  const quote = (quotes as {
    symbol: string; price: number; change: number; changePct: number;
    open: number | null; high: number | null; low: number | null;
    ldcp: number | null; volume: number | null;
  }[]).find((q) => q.symbol === symbol);

  const dividends: { declared_date: string; cash_dividend: number }[] =
    dividendData?.data?.dividends ?? [];

  const TABS: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "positions", label: "Positions" },
    { id: "dividends", label: "Dividends" },
  ];

  const ChangeIcon =
    !quote ? Minus
    : quote.changePct > 0 ? TrendingUp
    : quote.changePct < 0 ? TrendingDown
    : Minus;

  const priceColor = quote ? plColor(quote.changePct) : colors.muted;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pt-2 pb-4">
        <Pressable onPress={() => router.back()} className="size-9 items-center justify-center">
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <View className="flex-1">
          <ThemedText variant="title">{symbol}</ThemedText>
        </View>
      </View>

      {/* Price hero */}
      <View className="px-4 pb-4">
        {!quote ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : (
          <View className="flex-row items-end gap-3">
            <ThemedText variant="title" style={{ fontSize: 32 }} className="text-fg">
              {formatPKR(quote.price)}
            </ThemedText>
            <View className="flex-row items-center gap-1 mb-1">
              <ChangeIcon size={14} color={priceColor} />
              <ThemedText variant="body" style={{ color: priceColor }}>
                {quote.change >= 0 ? "+" : ""}{formatPKR(quote.change)} ({formatPercent(quote.changePct)})
              </ThemedText>
            </View>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row gap-0 px-4 mb-4">
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            className={`flex-1 py-2 items-center border-b-2 ${
              tab === t.id ? "border-accent" : "border-transparent"
            }`}
            onPress={() => setTab(t.id)}
          >
            <ThemedText
              variant="label"
              style={{ color: tab === t.id ? c.primary : colors.muted }}
            >
              {t.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false} contentContainerClassName="pb-10 gap-4">
        {tab === "overview" && (
          <Card className="px-0 pt-0">
            {quote ? (
              <>
                <StatRow label="Open" value={quote.open ? formatPKR(quote.open) : "—"} />
                <StatRow label="High" value={quote.high ? formatPKR(quote.high) : "—"} />
                <StatRow label="Low" value={quote.low ? formatPKR(quote.low) : "—"} />
                <StatRow label="Prev Close" value={quote.ldcp ? formatPKR(quote.ldcp) : "—"} />
                <StatRow label="Volume" value={quote.volume ? formatCompact(quote.volume) : "—"} />
              </>
            ) : (
              <ThemedText variant="caption" className="text-muted text-center py-6">
                No price data available
              </ThemedText>
            )}
          </Card>
        )}

        {tab === "positions" && (
          <PositionsTab symbol={symbol} portfolios={portfolios} />
        )}

        {tab === "dividends" && (
          dividends.length === 0 ? (
            <Card className="items-center py-8">
              <ThemedText variant="caption" className="text-muted">
                No dividend history found
              </ThemedText>
            </Card>
          ) : (
            <Card className="px-0 pt-0">
              {dividends.slice(0, 20).map((d, i) => (
                <View key={i} className="flex-row justify-between py-2 border-b border-border">
                  <ThemedText variant="caption" className="text-muted">{d.declared_date}</ThemedText>
                  <ThemedText variant="caption" style={{ color: colors.gain }}>
                    Rs {d.cash_dividend.toFixed(2)} / share
                  </ThemedText>
                </View>
              ))}
            </Card>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PositionsTab({
  symbol,
  portfolios,
}: {
  symbol: string;
  portfolios: { id: string; name: string }[];
}) {
  const symbols = [symbol];
  const { data: quotes = [] } = usePrices(symbols);
  const quote = (quotes as { symbol: string; price: number }[]).find((q) => q.symbol === symbol);

  return (
    <View className="gap-3">
      {portfolios.map((p) => (
        <PortfolioPositionCard
          key={p.id}
          portfolioId={p.id}
          portfolioName={p.name}
          symbol={symbol}
          currentPrice={quote?.price ?? null}
        />
      ))}
      {portfolios.length === 0 && (
        <Card className="items-center py-8">
          <ThemedText variant="caption" className="text-muted">No portfolios</ThemedText>
        </Card>
      )}
    </View>
  );
}

function PortfolioPositionCard({
  portfolioId,
  portfolioName,
  symbol,
  currentPrice,
}: {
  portfolioId: string;
  portfolioName: string;
  symbol: string;
  currentPrice: number | null;
}) {
  const { data: holdings = [] } = useHoldings(portfolioId);
  const holding = holdings.find((h) => h.symbol === symbol);
  if (!holding) return null;

  const price = currentPrice ?? holding.cost_basis;
  const value = price * holding.quantity;
  const cost = holding.cost_basis * holding.quantity;
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;

  return (
    <Card className="gap-2">
      <ThemedText variant="label" className="text-muted">{portfolioName}</ThemedText>
      <View className="flex-row justify-between">
        <View>
          <ThemedText variant="caption" className="text-muted">Qty</ThemedText>
          <ThemedText variant="body" className="text-fg">
            {holding.quantity.toLocaleString()}
          </ThemedText>
        </View>
        <View className="items-end">
          <ThemedText variant="caption" className="text-muted">Avg Cost</ThemedText>
          <ThemedText variant="body" className="text-fg">
            {formatPKR(holding.cost_basis)}
          </ThemedText>
        </View>
        <View className="items-end">
          <ThemedText variant="caption" className="text-muted">P/L</ThemedText>
          <ThemedText variant="body" style={{ color: plColor(pl) }}>
            {pl >= 0 ? "+" : ""}{formatPKR(pl)}
          </ThemedText>
          <ThemedText variant="caption" style={{ color: plColor(plPct) }}>
            {formatPercent(plPct)}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}
