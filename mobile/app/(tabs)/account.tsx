import { View, Text, ScrollView, Pressable, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Bell, ShieldCheck, Moon, LogOut, ChevronRight, User, Mail, ExternalLink } from "lucide-react-native";
import { useColors } from "@/lib/theme";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase";

const SETTINGS = [
  { label: "Price Alerts",  sub: "Set notifications for price moves", icon: Bell,        colorKey: "primary" as const, route: "/alerts" },
  { label: "Tax Settings",  sub: "Configure capital gains settings",  icon: ShieldCheck,  colorKey: "gain"    as const, route: null },
  { label: "Appearance",    sub: "Dark mode and theme preferences",   icon: Moon,         colorKey: "sky"     as const, route: null },
];

export default function AccountScreen() {
  const c = useColors();
  const { user } = useSession();

  const displayName = user?.user_metadata?.display_name ?? "Stockli User";
  const email = user?.email ?? "—";
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.canvas }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: c.fg, letterSpacing: -0.8 }}>Account</Text>
        </View>

        {/* Profile card */}
        <View style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 24, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: c.primary + "20", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: c.primary }}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: c.fg, marginBottom: 2 }}>{displayName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Mail size={12} color={c.muted} />
                <Text style={{ fontSize: 13, color: c.muted }}>{email}</Text>
              </View>
            </View>
          </View>
          <Pressable style={({ pressed }) => ({ borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingVertical: 10, alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: c.primary }}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Settings section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
            Settings
          </Text>
          <View style={{ borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
            {SETTINGS.map((row, i) => {
              const Icon = row.icon;
              const color = c[row.colorKey];
              return (
                <Pressable
                  key={row.label}
                  onPress={() => row.route && router.push(row.route as never)}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
                    borderBottomWidth: i < SETTINGS.length - 1 ? 1 : 0,
                    borderBottomColor: c.border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: color + "20", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={17} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: c.fg }}>{row.label}</Text>
                    <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>{row.sub}</Text>
                  </View>
                  <ChevronRight size={16} color={c.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* About section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: c.muted, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
            About
          </Text>
          <View style={{ borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
            {[
              { label: "Version", value: "1.0.0" },
              { label: "PSX Data", value: "Real-time" },
              { label: "Privacy Policy", value: null },
              { label: "Terms of Service", value: null },
            ].map((item, i, arr) => (
              <View key={item.label} style={{ flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: c.border }}>
                <Text style={{ flex: 1, fontSize: 14, color: c.fg, fontWeight: "500" }}>{item.label}</Text>
                {item.value
                  ? <Text style={{ fontSize: 13, color: c.muted }}>{item.value}</Text>
                  : <ExternalLink size={14} color={c.muted} />}
              </View>
            ))}
          </View>
        </View>

        {/* Sign out */}
        <View style={{ paddingHorizontal: 20 }}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              borderRadius: 16, borderWidth: 1, borderColor: c.loss + "40",
              backgroundColor: c.lossDim, paddingVertical: 15,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <LogOut size={16} color={c.loss} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: c.loss }}>Sign out</Text>
          </Pressable>
        </View>

        <Text style={{ textAlign: "center", fontSize: 12, color: c.muted, marginTop: 24 }}>
          Stockli © 2025
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
