import { useState } from "react";
import { View, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Search } from "lucide-react-native";
import { useColors } from "@/lib/theme";
import { ThemedText } from "./ThemedText";
import { useStockCache, type StockInfo } from "@/hooks/useStockCache";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (stock: StockInfo) => void;
  placeholder?: string;
}

export function StockSearchInput({ value, onChange, onSelect, placeholder = "Symbol (e.g. ENGRO)" }: Props) {
  const c = useColors();
  const { stocks } = useStockCache();
  const [open, setOpen] = useState(false);

  const q = value.trim().toUpperCase();
  const suggestions: StockInfo[] = open && q.length > 0
    ? stocks
        .filter((s) => s.symbol.startsWith(q) || s.name.toUpperCase().includes(q))
        .slice(0, 6)
    : [];

  return (
    <View style={{ position: "relative", zIndex: 10 }}>
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: c.card, borderWidth: 1, borderColor: open ? c.primary : c.border,
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
      }}>
        <Search size={15} color={c.muted} />
        <TextInput
          style={{ flex: 1, color: c.fg, fontSize: 15 }}
          placeholder={placeholder}
          placeholderTextColor={c.muted}
          value={value}
          onChangeText={(v) => { onChange(v); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          autoCapitalize="characters"
          returnKeyType="search"
        />
      </View>
      {suggestions.length > 0 && (
        <View style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
          borderRadius: 12, marginTop: 4, overflow: "hidden",
          shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
        }}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={s.symbol}
              activeOpacity={0.7}
              onPress={() => { onSelect(s); onChange(s.symbol); setOpen(false); }}
              style={{
                flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 11,
                borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                borderBottomColor: c.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <ThemedText variant="body" style={{ fontWeight: "700" }}>{s.symbol}</ThemedText>
                <ThemedText variant="caption" style={{ color: c.muted }} numberOfLines={1}>{s.name}</ThemedText>
              </View>
              {s.sector ? (
                <ThemedText variant="caption" style={{ color: c.muted, marginLeft: 8 }} numberOfLines={1}>
                  {s.sector}
                </ThemedText>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
