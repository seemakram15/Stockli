import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { useColorScheme } from "nativewind";
import { Stack, router } from "expo-router";
import { useSession } from "@/hooks/useSession";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading } = useSession();
  const { colorScheme } = useColorScheme();

  React.useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  React.useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/(auth)/login");
    } else {
      router.replace("/(tabs)");
    }
  }, [session, loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="stock/[symbol]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="portfolio/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
