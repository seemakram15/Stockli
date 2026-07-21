import { useState } from "react";
import { View, ScrollView, Pressable, Alert, TextInput, Modal, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Plus, Eye, Trash2, TrendingUp, TrendingDown, X } from "lucide-react-native";
import { colors, useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { useWatchlists } from "@/hooks/usePortfolio";
import { usePrices } from "@/hooks/useMarket";
import { db, type Watchlist, type WatchlistItem } from "@/lib/db";
import { formatPKR, formatPercent, plColor } from "@/lib/format";

function PriceChip({ symbol, prices }: { symbol: string; prices: Record<string, number> }) {
  const price = prices[symbol];
  if (!price) return <ThemedText variant="caption">—</ThemedText>;
  return <ThemedText className="text-[13px] font-semibold text-fg">{formatPKR(price)}</ThemedText>;
}

function WatchlistSection({
  watchlist,
  prices,
  onAddSymbol,
  onRemoveItem,
}: {
  watchlist: Watchlist & { items: WatchlistItem[] };
  prices: Record<string, number>;
  onAddSymbol: (watchlistId: string) => void;
  onRemoveItem: (itemId: string, symbol: string) => void;
}) {
  const c = useColors();
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between ml-1">
        <ThemedText variant="label">{watchlist.name}</ThemedText>
        <Pressable
          onPress={() => onAddSymbol(watchlist.id)}
          className="flex-row items-center gap-1 px-2 py-1 rounded-lg bg-accent/20"
        >
          <Plus size={12} color={c.primary} />
          <ThemedText className="text-[12px] font-semibold text-primary">Add</ThemedText>
        </Pressable>
      </View>

      {watchlist.items.length === 0 ? (
        <Card className="items-center py-8 gap-2">
          <Eye size={28} color={c.muted} />
          <ThemedText variant="caption">No symbols yet</ThemedText>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          {watchlist.items.map((item, i) => (
            <View
              key={item.id}
              className={`flex-row items-center gap-3 px-4 py-3 ${i < watchlist.items.length - 1 ? "border-b border-border" : ""}`}
            >
              <View className="flex-1">
                <ThemedText variant="subhead" className="text-fg font-semibold">{item.symbol}</ThemedText>
              </View>
              <PriceChip symbol={item.symbol} prices={prices} />
              <Pressable
                onPress={() => onRemoveItem(item.id, item.symbol)}
                hitSlop={8}
                className="ml-2 p-1"
              >
                <Trash2 size={14} color={colors.loss} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

export default function WatchlistScreen() {
  const c = useColors();
  const { data: watchlists, isLoading, mutate } = useWatchlists();

  const allSymbols = (watchlists ?? []).flatMap((w) => w.items.map((i) => i.symbol));
  const { data: priceData = [] } = usePrices(allSymbols);
  const prices: Record<string, number> = {};
  (priceData as { symbol: string; price: number }[]).forEach((q) => { prices[q.symbol] = q.price; });

  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [symbolInput, setSymbolInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAddSymbol() {
    if (!addingToId || !symbolInput.trim()) return;
    setSaving(true);
    try {
      await db.watchlists.addItem(addingToId, symbolInput.trim().toUpperCase());
      mutate();
      setAddingToId(null);
      setSymbolInput("");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to add symbol");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveItem(itemId: string, symbol: string) {
    Alert.alert("Remove", `Remove ${symbol} from watchlist?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await db.watchlists.removeItem(itemId);
            mutate();
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Failed to remove");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Watchlists</ThemedText>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-10 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {(watchlists ?? []).map((wl) => (
            <WatchlistSection
              key={wl.id}
              watchlist={wl}
              prices={prices}
              onAddSymbol={setAddingToId}
              onRemoveItem={handleRemoveItem}
            />
          ))}

          {(watchlists ?? []).length === 0 && (
            <Card className="items-center py-12 gap-3">
              <Eye size={36} color={colors.muted} />
              <ThemedText variant="subhead" className="text-muted">No watchlists found</ThemedText>
              <ThemedText variant="caption" className="text-center px-8">
                Create watchlists on the web app and they'll appear here
              </ThemedText>
            </Card>
          )}
        </ScrollView>
      )}

      <Modal visible={!!addingToId} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/60 items-center justify-center px-8"
          onPress={() => { setAddingToId(null); setSymbolInput(""); }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-surface rounded-2xl p-5 gap-4 w-full" style={{ minWidth: 280 }}>
              <ThemedText variant="subhead" className="text-fg font-semibold">Add Symbol</ThemedText>
              <TextInput
                className="bg-card2 border border-border rounded-xl px-4 py-3 text-text text-[15px]"
                placeholder="e.g. ENGRO"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                value={symbolInput}
                onChangeText={setSymbolInput}
                autoFocus
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => { setAddingToId(null); setSymbolInput(""); }}
                  className="flex-1 py-3 rounded-xl border border-border items-center"
                >
                  <ThemedText className="text-[14px] font-semibold text-muted">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleAddSymbol}
                  disabled={saving || !symbolInput.trim()}
                  className="flex-1 py-3 rounded-xl bg-accent items-center"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText className="text-[14px] font-semibold text-white">Add</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
