import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

export default function NotFoundScreen() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-[#0f0f13] px-8">
      <Text className="text-[48px]">404</Text>
      <Text className="mt-4 text-[20px] font-bold text-text">Page not found</Text>
      <Text className="mt-2 text-center text-[15px] text-muted">This screen doesn't exist yet.</Text>
      <Pressable onPress={() => router.replace("/(tabs)")} className="mt-8 rounded-2xl bg-accent px-6 py-3">
        <Text className="text-[15px] font-bold text-white">Go to Dashboard</Text>
      </Pressable>
    </SafeAreaView>
  );
}
