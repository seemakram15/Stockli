import { useState } from "react";
import { View, ScrollView, Pressable, Alert, TextInput, Modal, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Plus, Bell, BellOff, Trash2, TrendingUp, TrendingDown } from "lucide-react-native";
import { colors, useColors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { useAlerts } from "@/hooks/usePortfolio";
import { db } from "@/lib/db";
import { formatPKR } from "@/lib/format";

export default function AlertsScreen() {
  const c = useColors();
  const { data: alerts, isLoading, mutate } = useAlerts();

  const [showCreate, setShowCreate] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    const p = parseFloat(price);
    if (!symbol.trim() || isNaN(p) || p <= 0) {
      Alert.alert("Invalid", "Enter a valid symbol and price");
      return;
    }
    setSaving(true);
    try {
      await db.alerts.create(symbol.trim().toUpperCase(), condition, p);
      mutate();
      setShowCreate(false);
      setSymbol("");
      setPrice("");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to create alert");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, sym: string) {
    Alert.alert("Delete Alert", `Delete price alert for ${sym}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await db.alerts.delete(id);
            mutate();
          } catch (e: any) {
            Alert.alert("Error", e.message ?? "Failed to delete");
          }
        },
      },
    ]);
  }

  const active = (alerts ?? []).filter((a) => a.is_active && !a.triggered_at);
  const triggered = (alerts ?? []).filter((a) => a.triggered_at);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <ThemedText variant="title" className="flex-1">Price Alerts</ThemedText>
        <Pressable
          onPress={() => setShowCreate(true)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/20"
        >
          <Plus size={14} color={c.primary} />
          <ThemedText className="text-[13px] font-semibold text-primary">New</ThemedText>
        </Pressable>
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
          {(alerts ?? []).length === 0 ? (
            <Card className="items-center py-12 gap-3">
              <Bell size={36} color={colors.muted} />
              <ThemedText variant="subhead" className="text-muted">No alerts yet</ThemedText>
              <ThemedText variant="caption" className="text-center px-8">
                Get notified when a stock hits your target price
              </ThemedText>
              <Pressable
                onPress={() => setShowCreate(true)}
                className="px-5 py-2.5 rounded-xl bg-accent mt-1"
              >
                <ThemedText className="text-[14px] font-semibold text-white">Create Alert</ThemedText>
              </Pressable>
            </Card>
          ) : (
            <>
              {active.length > 0 && (
                <View className="gap-2">
                  <ThemedText variant="label" className="ml-1">Active</ThemedText>
                  <Card className="p-0 overflow-hidden">
                    {active.map((alert, i) => (
                      <View
                        key={alert.id}
                        className={`flex-row items-center gap-3 px-4 py-3.5 ${i < active.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <View
                          className="size-9 items-center justify-center rounded-xl"
                          style={{ backgroundColor: (alert.condition === "ABOVE" ? colors.gain : colors.loss) + "20" }}
                        >
                          {alert.condition === "ABOVE" ? (
                            <TrendingUp size={16} color={colors.gain} />
                          ) : (
                            <TrendingDown size={16} color={colors.loss} />
                          )}
                        </View>
                        <View className="flex-1">
                          <ThemedText variant="subhead" className="text-text font-semibold">{alert.symbol}</ThemedText>
                          <ThemedText variant="caption" className="mt-0.5">
                            {alert.condition === "ABOVE" ? "Above" : "Below"} {formatPKR(alert.price)}
                          </ThemedText>
                        </View>
                        <Pressable onPress={() => handleDelete(alert.id, alert.symbol)} hitSlop={8} className="p-1">
                          <Trash2 size={15} color={colors.loss} />
                        </Pressable>
                      </View>
                    ))}
                  </Card>
                </View>
              )}

              {triggered.length > 0 && (
                <View className="gap-2">
                  <ThemedText variant="label" className="ml-1">Triggered</ThemedText>
                  <Card className="p-0 overflow-hidden">
                    {triggered.map((alert, i) => (
                      <View
                        key={alert.id}
                        className={`flex-row items-center gap-3 px-4 py-3.5 opacity-50 ${i < triggered.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <View className="size-9 items-center justify-center rounded-xl bg-muted/10">
                          <BellOff size={16} color={colors.muted} />
                        </View>
                        <View className="flex-1">
                          <ThemedText variant="subhead" className="text-muted font-semibold">{alert.symbol}</ThemedText>
                          <ThemedText variant="caption" className="mt-0.5">
                            {alert.condition === "ABOVE" ? "Above" : "Below"} {formatPKR(alert.price)} · Triggered
                          </ThemedText>
                        </View>
                        <Pressable onPress={() => handleDelete(alert.id, alert.symbol)} hitSlop={8} className="p-1">
                          <Trash2 size={15} color={colors.muted} />
                        </Pressable>
                      </View>
                    ))}
                  </Card>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={showCreate} transparent animationType="slide" presentationStyle="overFullScreen">
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setShowCreate(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-surface rounded-t-3xl px-5 pt-5 pb-10 gap-5">
              <View className="flex-row items-center justify-between">
                <ThemedText variant="subhead" className="text-text text-[17px] font-bold">New Price Alert</ThemedText>
                <Pressable onPress={() => setShowCreate(false)} hitSlop={8}>
                  <ThemedText className="text-muted text-[14px]">Cancel</ThemedText>
                </Pressable>
              </View>

              <View className="gap-1.5">
                <ThemedText variant="caption" className="ml-1">Symbol</ThemedText>
                <TextInput
                  className="bg-card2 border border-border rounded-xl px-4 py-3 text-text text-[15px]"
                  placeholder="e.g. ENGRO"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  value={symbol}
                  onChangeText={setSymbol}
                />
              </View>

              <View className="gap-1.5">
                <ThemedText variant="caption" className="ml-1">Condition</ThemedText>
                <View className="flex-row gap-2">
                  {(["ABOVE", "BELOW"] as const).map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCondition(c)}
                      className="flex-1 py-3 rounded-xl items-center border"
                      style={{
                        backgroundColor: condition === c ? (c === "ABOVE" ? colors.gain + "20" : colors.loss + "20") : "transparent",
                        borderColor: condition === c ? (c === "ABOVE" ? colors.gain : colors.loss) : colors.border,
                      }}
                    >
                      <ThemedText
                        className="text-[14px] font-semibold"
                        style={{ color: condition === c ? (c === "ABOVE" ? colors.gain : colors.loss) : colors.muted }}
                      >
                        {c === "ABOVE" ? "↑ Above" : "↓ Below"}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View className="gap-1.5">
                <ThemedText variant="caption" className="ml-1">Target Price (PKR)</ThemedText>
                <TextInput
                  className="bg-card2 border border-border rounded-xl px-4 py-3 text-text text-[15px]"
                  placeholder="e.g. 450.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>

              <Pressable
                onPress={handleCreate}
                disabled={saving || !symbol.trim() || !price.trim()}
                className="py-4 rounded-2xl bg-accent items-center"
                style={{ opacity: saving || !symbol.trim() || !price.trim() ? 0.5 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText className="text-[15px] font-bold text-white">Create Alert</ThemedText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
