import { Pressable, Text, ActivityIndicator, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const base = "flex-row items-center justify-center gap-2 rounded-2xl px-5 py-3.5";

const variants: Record<Variant, { container: string; text: string }> = {
  primary:     { container: "bg-accent active:opacity-80", text: "text-white font-bold text-[15px]" },
  secondary:   { container: "bg-surface border border-border active:opacity-70", text: "text-text font-semibold text-[15px]" },
  ghost:       { container: "active:bg-surface", text: "text-accent font-semibold text-[15px]" },
  destructive: { container: "bg-loss/20 border border-loss/30 active:opacity-70", text: "text-loss font-semibold text-[15px]" },
};

export function Button({
  variant = "primary",
  label,
  loading = false,
  className = "",
  ...props
}: PressableProps & {
  variant?: Variant;
  label: string;
  loading?: boolean;
  className?: string;
}) {
  const v = variants[variant];
  return (
    <Pressable className={`${base} ${v.container} ${className}`} {...props}>
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : "#8b5cf6"} />
      ) : (
        <Text className={v.text}>{label}</Text>
      )}
    </Pressable>
  );
}
