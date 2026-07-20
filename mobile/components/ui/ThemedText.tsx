import { Text, type TextProps } from "react-native";

type Variant = "title" | "subhead" | "body" | "caption" | "label" | "mono";

const variantClass: Record<Variant, string> = {
  title:   "text-[20px] font-bold tracking-tight text-text",
  subhead: "text-[17px] font-semibold text-text",
  body:    "text-[15px] text-muted",
  caption: "text-[13px] text-muted",
  label:   "text-[11px] font-bold uppercase tracking-widest text-muted",
  mono:    "text-[13px] font-mono tabular-nums text-text",
};

export function ThemedText({
  variant = "body",
  className = "",
  ...props
}: TextProps & { variant?: Variant; className?: string }) {
  return <Text className={`${variantClass[variant]} ${className}`} {...props} />;
}
