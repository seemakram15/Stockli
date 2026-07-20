import { TextInput, View, type TextInputProps } from "react-native";
import { ThemedText } from "./ThemedText";

export function Input({
  label,
  error,
  className = "",
  ...props
}: TextInputProps & { label?: string; error?: string; className?: string }) {
  return (
    <View className="gap-1.5">
      {label ? <ThemedText variant="label">{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor="#8888a8"
        className={`h-12 rounded-xl border border-border bg-surface px-4 text-[15px] text-text focus:border-accent ${className}`}
        {...props}
      />
      {error ? <ThemedText variant="caption" className="text-loss">{error}</ThemedText> : null}
    </View>
  );
}
