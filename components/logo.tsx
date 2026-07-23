"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

/** Matched icon + wordmark color pairs. Always keep these together. */
export type BrandPair = "green" | "purple" | "gold";

/**
 * Surface → pair mapping:
 * - desktop / auth: green (professional)
 * - mobile: purple
 * - auth-reset: gold
 * - auto: green ≥sm, purple <sm
 * - mark: green icon only (PWA primary)
 */
export type LogoSurface =
  | "auto"
  | "desktop"
  | "mobile"
  | "auth"
  | "auth-reset"
  | "mark";

const PAIR_BY_SURFACE: Record<Exclude<LogoSurface, "auto" | "mark">, BrandPair> = {
  desktop: "green",
  auth: "green",
  mobile: "purple",
  "auth-reset": "gold",
};

const BRAND = {
  green: {
    icon: "/brand/mystockli-icon-green.png",
    wordmark: "/brand/mystockli-wordmark-green.png",
  },
  purple: {
    icon: "/brand/mystockli-icon-purple.png",
    wordmark: "/brand/mystockli-wordmark-purple.png",
  },
  gold: {
    icon: "/brand/mystockli-icon-gold.png",
    wordmark: "/brand/mystockli-wordmark-gold.png",
  },
} as const;

export function pairForSurface(surface: LogoSurface): BrandPair {
  if (surface === "mark") return "green";
  if (surface === "auto") return "green"; // desktop default; CSS swaps mobile
  return PAIR_BY_SURFACE[surface];
}

export function Logo({
  className,
  showText = true,
  beta = false,
  surface = "auto",
}: {
  className?: string;
  showText?: boolean;
  beta?: boolean;
  surface?: LogoSurface;
}) {
  if (surface === "auto") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <span className="inline-flex items-center gap-2 sm:hidden">
          <PairMark pair="purple" markClassName="size-8" showText={showText} beta={beta} />
        </span>
        <span className="hidden items-center gap-2 sm:inline-flex">
          <PairMark pair="green" markClassName="size-8" showText={showText} beta={beta} />
        </span>
      </span>
    );
  }

  if (surface === "mark") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <BrandMark pair="green" className="size-8" />
      </span>
    );
  }

  const pair = PAIR_BY_SURFACE[surface];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PairMark pair={pair} markClassName="size-8" showText={showText} beta={beta} />
    </span>
  );
}

function PairMark({
  pair,
  markClassName,
  showText,
  beta,
}: {
  pair: BrandPair;
  markClassName?: string;
  showText: boolean;
  beta: boolean;
}) {
  return (
    <>
      <BrandMark pair={pair} className={cn("shrink-0", markClassName)} />
      {showText ? (
        <span className="flex items-center gap-1.5 leading-none">
          <BrandWordmark pair={pair} />
          {beta ? (
            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-500">
              Beta
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

/** Hexagon app mark for a color pair. */
export function BrandMark({
  className,
  pair = "green",
}: {
  className?: string;
  pair?: BrandPair;
}) {
  return (
    <Image
      src={BRAND[pair].icon}
      alt=""
      width={80}
      height={90}
      className={cn("object-contain", className)}
      aria-hidden
      priority
    />
  );
}

export function BrandWordmark({
  className,
  pair = "green",
}: {
  className?: string;
  pair?: BrandPair;
}) {
  return (
    <Image
      src={BRAND[pair].wordmark}
      alt={APP_NAME}
      width={220}
      height={48}
      className={cn("h-5 w-auto max-w-[9.5rem] object-contain object-left sm:h-7 sm:max-w-none", className)}
      priority
    />
  );
}

/** @deprecated Use BrandMark */
export function MyStockliGlyph({
  className,
  pair = "green",
}: {
  className?: string;
  pair?: BrandPair;
}) {
  return <BrandMark className={className} pair={pair} />;
}

/** @deprecated Use BrandMark */
export const StockliGlyph = MyStockliGlyph;
