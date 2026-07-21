import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { useColorScheme } from "nativewind";
import { Stack, router } from "expo-router";
import { useSession } from "@/hooks/useSession";
import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, loading } = useSession();
  const { colorScheme, setColorScheme } = useColorScheme();

  React.useEffect(() => { setColorScheme("light"); }, []);

  React.useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  React.useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/(auth)");
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
      <Stack.Screen
        name="market/psx"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="market/sectors"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="market/mutual-funds"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="market/etfs"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="market/fipi-lipi"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="market/[slug]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="search"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen name="watchlist" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="alerts" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="fundamentals" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="pivot-points" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="stock-analyzer" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="board-meetings" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="book-closures" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="dividend-history" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="useful-links" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="youtubers" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="appearance" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="tax-settings" options={{ presentation: "card", animation: "slide_from_right" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
