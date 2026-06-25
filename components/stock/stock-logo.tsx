"use client";

import Image from "next/image";
import * as React from "react";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "size-9 rounded-lg text-xs",
  md: "size-10 rounded-xl text-sm",
  lg: "size-12 rounded-xl text-base",
} as const;

export function StockLogo({
  symbol,
  name,
  image,
  size = "md",
  className,
}: {
  symbol: string;
  name?: string | null;
  image?: string | null;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const normalized = symbol.trim().toUpperCase();
  const candidates = React.useMemo(() => {
    const urls = [image, normalized ? `https://admin.askanalyst.com.pk/logo16/${normalized}.svg` : null]
      .filter((url): url is string => Boolean(url))
      .filter((url, index, array) => array.indexOf(url) === index);
    return urls;
  }, [image, normalized]);
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    setIndex(0);
  }, [candidates]);

  const logoUrl = candidates[index];
  const sizeClass = SIZE_CLASSES[size];

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${name ?? normalized} logo`}
        width={48}
        height={48}
        unoptimized
        className={cn("shrink-0 border bg-background object-contain p-1", sizeClass, className)}
        onError={() => setIndex((current) => current + 1)}
      />
    );
  }

  return (
    <span
      aria-label={`${name ?? normalized} logo`}
      className={cn(
        "flex shrink-0 items-center justify-center border bg-primary/10 font-bold text-primary",
        sizeClass,
        className
      )}
    >
      {normalized.slice(0, 2)}
    </span>
  );
}
