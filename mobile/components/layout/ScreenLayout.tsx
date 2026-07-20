import { ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ui/ThemedText";

export function ScreenLayout({
  title,
  scrollable = true,
  children,
  headerRight,
}: {
  title?: string;
  scrollable?: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  const header = title ? (
    <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
      <ThemedText variant="title">{title}</ThemedText>
      {headerRight}
    </View>
  ) : null;

  if (scrollable) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
        {header}
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-10"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f0f13]" edges={["top"]}>
      {header}
      <View className="flex-1 px-4">{children}</View>
    </SafeAreaView>
  );
}
