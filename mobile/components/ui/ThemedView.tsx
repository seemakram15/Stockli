import { View, type ViewProps } from "react-native";
import { useColorScheme } from "nativewind";

export function ThemedView({ className = "", ...props }: ViewProps & { className?: string }) {
  return <View className={`bg-[#0f0f13] dark:bg-[#0f0f13] ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-2xl border border-border bg-surface p-4 ${className}`}
      {...props}
    />
  );
}

export function Row({ className = "", ...props }: ViewProps & { className?: string }) {
  return <View className={`flex-row items-center ${className}`} {...props} />;
}
