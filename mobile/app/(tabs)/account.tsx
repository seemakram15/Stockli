import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Bell, ShieldCheck, User, LogOut, Moon } from "lucide-react-native";
import { colors } from "@/lib/theme";
import { Card } from "@/components/ui/ThemedView";
import { ThemedText } from "@/components/ui/ThemedText";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase";

const SETTINGS_ROWS = [
  { label: "Notifications", icon: Bell, color: colors.accent },
  { label: "Tax Settings", icon: ShieldCheck, color: colors.gain },
  { label: "Appearance", icon: Moon, color: colors.sky },
];

export default function AccountScreen() {
  const { user } = useSession();

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="py-2">
          <ThemedText variant="title">Account</ThemedText>
        </View>

        {/* Profile card */}
        <Card className="flex-row items-center gap-4">
          <View className="size-14 items-center justify-center rounded-full bg-accent/20">
            <User size={24} color={colors.accent} />
          </View>
          <View className="flex-1">
            <ThemedText variant="subhead" className="text-text">
              {user?.user_metadata?.display_name ?? "Stockli User"}
            </ThemedText>
            <ThemedText variant="caption" className="mt-0.5">{user?.email ?? "—"}</ThemedText>
          </View>
          <Pressable className="rounded-lg border border-border px-3 py-1.5">
            <Text className="text-[13px] font-semibold text-accent">Edit</Text>
          </Pressable>
        </Card>

        {/* Settings */}
        <View className="gap-2">
          <ThemedText variant="label" className="ml-1">Settings</ThemedText>
          <Card className="p-0 overflow-hidden">
            {SETTINGS_ROWS.map((row, i) => {
              const Icon = row.icon;
              return (
                <Pressable
                  key={row.label}
                  className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-surface-2 ${i < SETTINGS_ROWS.length - 1 ? "border-b border-border" : ""}`}
                >
                  <View className="size-9 items-center justify-center rounded-xl" style={{ backgroundColor: row.color + "20" }}>
                    <Icon size={16} color={row.color} />
                  </View>
                  <ThemedText variant="subhead" className="flex-1 text-[15px] font-medium text-text">{row.label}</ThemedText>
                  <ChevronRight size={16} color={colors.muted} />
                </Pressable>
              );
            })}
          </Card>
        </View>

        {/* Sign out */}
        <Pressable
          onPress={handleSignOut}
          className="flex-row items-center justify-center gap-2 rounded-2xl border border-loss/30 bg-loss/10 py-3.5 active:opacity-70"
        >
          <LogOut size={16} color={colors.loss} />
          <Text className="text-[15px] font-semibold text-loss">Sign out</Text>
        </Pressable>

        <ThemedText variant="caption" className="text-center text-muted">
          Stockli v1.0.0
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}
