"use client";

import * as React from "react";
import { Skeleton as BoneyardSkeleton, configureBoneyard } from "boneyard-js/react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

configureBoneyard({
  animate: "shimmer",
  transition: 150,
});

export type PageLoadingVariant =
  | "default"
  | "dashboard"
  | "market"
  | "global-market"
  | "portfolio"
  | "portfolio-detail"
  | "stock"
  | "fundamentals"
  | "sector-list"
  | "sector-detail"
  | "list"
  | "admin"
  | "admin-user"
  | "fund-detail"
  | "strategy";

export function PageLoadingState({
  message,
  variant: variantProp,
}: {
  message: string;
  variant?: PageLoadingVariant;
}) {
  const variant = variantProp ?? inferVariant(message);
  const shell = <PageLoadingShell message={message} variant={variant} />;

  return (
    <BoneyardSkeleton loading name={`page-loading:${variant}`} fallback={shell}>
      {shell}
    </BoneyardSkeleton>
  );
}

function PageLoadingShell({
  message,
  variant,
}: {
  message: string;
  variant: PageLoadingVariant;
}) {
  return (
    <div className="min-h-[calc(100svh-8rem)] w-full">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90 shadow-sm">
          <div className="bg-gradient-to-br from-primary/10 via-background to-background p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <Skeleton className="size-11 shrink-0 rounded-2xl bg-primary/15" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-8 w-64 max-w-full" />
                  <Skeleton className="h-4 w-5/6 max-w-[36rem]" />
                </div>
              </div>
              <Skeleton className="h-9 w-32 shrink-0 rounded-full" />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
              {message}
            </p>
          </div>
        </div>

        {renderVariant(variant)}
      </div>
    </div>
  );
}

function renderVariant(variant: PageLoadingVariant) {
  switch (variant) {
    case "dashboard":
      return <DashboardSkeleton />;
    case "market":
      return <MarketSkeleton />;
    case "global-market":
      return <GlobalMarketSkeleton />;
    case "portfolio":
      return <PortfolioHubSkeleton />;
    case "portfolio-detail":
      return <PortfolioDetailSkeleton />;
    case "stock":
      return <StockSkeleton />;
    case "fundamentals":
      return <FundamentalsSkeleton />;
    case "sector-list":
      return <SectorListSkeleton />;
    case "sector-detail":
      return <SectorDetailSkeleton />;
    case "list":
      return <ListSkeleton />;
    case "admin":
      return <AdminSkeleton />;
    case "admin-user":
      return <AdminUserSkeleton />;
    case "fund-detail":
      return <FundDetailSkeleton />;
    case "strategy":
      return <StrategySkeleton />;
    case "default":
    default:
      return <DefaultSkeleton />;
  }
}

function DefaultSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <LoadingCard className="lg:col-span-2">
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
          <TableSkeleton rows={5} />
        </div>
      </LoadingCard>

      <LoadingCard>
        <div className="space-y-3 p-4 sm:p-5">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 4 }).map((_, index) => (
            <ListRowSkeleton key={index} />
          ))}
        </div>
      </LoadingCard>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-9 w-80 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <MarketCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricTile key={index} />
        ))}
      </div>

      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <AccordionSkeleton key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>
    </div>
  );
}

function GlobalMarketSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricTile key={index} />
        ))}
      </div>

      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
          <Skeleton className="h-52 rounded-2xl" />
          <TableSkeleton rows={6} />
        </div>
      </LoadingCard>
    </div>
  );
}

function PortfolioHubSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-80 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <MiniStatCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingCard className="lg:col-span-2">
          <div className="space-y-4 p-4 sm:p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </LoadingCard>
        <div className="space-y-4">
          <LoadingCard>
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 4 }).map((_, index) => (
                <ListRowSkeleton key={index} />
              ))}
            </div>
          </LoadingCard>
          <LoadingCard>
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-5 w-36" />
              {Array.from({ length: 3 }).map((_, index) => (
                <ListRowSkeleton key={index} />
              ))}
            </div>
          </LoadingCard>
        </div>
      </div>
    </div>
  );
}

function PortfolioDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
      </div>
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-72 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingCard className="lg:col-span-2">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            <TableSkeleton rows={6} />
          </div>
        </LoadingCard>
        <LoadingCard>
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 5 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </LoadingCard>
      </div>
    </div>
  );
}

function StockSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
          <Skeleton className="h-10 w-48 rounded-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingCard className="lg:col-span-2">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </LoadingCard>
        <div className="space-y-4">
          <LoadingCard>
            <div className="grid grid-cols-2 gap-3 p-4 sm:p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <MiniStatCardSkeleton key={index} compact />
              ))}
            </div>
          </LoadingCard>
          <LoadingCard>
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 3 }).map((_, index) => (
                <ListRowSkeleton key={index} />
              ))}
            </div>
          </LoadingCard>
        </div>
      </div>

      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </LoadingCard>
    </div>
  );
}

function FundamentalsSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
          <Skeleton className="h-11 rounded-xl" />
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <MiniStatCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <LoadingCard>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        </LoadingCard>
        <LoadingCard>
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 5 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </LoadingCard>
      </div>
    </div>
  );
}

function SectorListSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-11 rounded-xl" />
        </div>
      </LoadingCard>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricTile key={index} />
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <AccordionSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

function SectorDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64 max-w-full" />
              <Skeleton className="h-4 w-96 max-w-full" />
            </div>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingCard className="lg:col-span-2">
          <div className="space-y-4 p-4 sm:p-5">
            <Skeleton className="h-5 w-36" />
            <TableSkeleton rows={6} />
          </div>
        </LoadingCard>
        <LoadingCard>
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 5 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </LoadingCard>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <Skeleton className="h-11 rounded-xl" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>
    </div>
  );
}

function AdminSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricTile key={index} />
        ))}
      </div>

      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </LoadingCard>

      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <Skeleton className="h-5 w-32" />
          <TableSkeleton rows={6} />
        </div>
      </LoadingCard>
    </div>
  );
}

function AdminUserSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-20" />
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingCard className="lg:col-span-2">
          <div className="space-y-4 p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            <TableSkeleton rows={6} />
          </div>
        </LoadingCard>
        <div className="space-y-4">
          <LoadingCard>
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 4 }).map((_, index) => (
                <ListRowSkeleton key={index} />
              ))}
            </div>
          </LoadingCard>
          <LoadingCard>
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 3 }).map((_, index) => (
                <ListRowSkeleton key={index} />
              ))}
            </div>
          </LoadingCard>
        </div>
      </div>
    </div>
  );
}

function FundDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-72 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <LoadingCard className="lg:col-span-2">
          <div className="space-y-4 p-4 sm:p-5">
            <Skeleton className="h-5 w-24" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <MiniStatCardSkeleton key={index} />
              ))}
            </div>
          </div>
        </LoadingCard>
        <LoadingCard>
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 6 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </LoadingCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LoadingCard>
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 4 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </LoadingCard>
        <LoadingCard>
          <div className="space-y-3 p-4 sm:p-5">
            <Skeleton className="h-5 w-36" />
            {Array.from({ length: 5 }).map((_, index) => (
              <ListRowSkeleton key={index} />
            ))}
          </div>
        </LoadingCard>
      </div>
    </div>
  );
}

function StrategySkeleton() {
  return (
    <div className="space-y-4">
      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-24 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <MetricTile key={index} />
            ))}
          </div>
        </div>
      </LoadingCard>

      <LoadingCard>
        <div className="space-y-4 p-4 sm:p-5">
          <Skeleton className="h-5 w-40" />
          <TableSkeleton rows={6} />
        </div>
      </LoadingCard>
    </div>
  );
}

function MarketCardSkeleton() {
  return (
    <LoadingCard className="min-h-[24rem]">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-2xl" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-40 max-w-full" />
              <Skeleton className="h-3.5 w-28 max-w-full" />
            </div>
          </div>
          <Skeleton className="size-9 rounded-full" />
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <ListRowSkeleton key={index} compact />
          ))}
        </div>
      </div>
    </LoadingCard>
  );
}

function AccordionSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-emerald-50/60 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div className="flex items-center justify-between gap-3 border-b border-emerald-200/60 bg-emerald-50/85 px-4 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-5 w-52 max-w-full rounded-full" />
          <Skeleton className="h-3.5 w-80 max-w-full rounded-full" />
        </div>
        <Skeleton className="size-5 rounded-full" />
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="flex h-full">
            <Skeleton className="h-full w-1/3 rounded-none rounded-l-full" />
            <Skeleton className="h-full w-1/4 rounded-none" />
            <Skeleton className="h-full w-1/3 rounded-none rounded-r-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-6 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <ListRowSkeleton key={index} compact />
          ))}
        </div>
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="grid grid-cols-[minmax(0,2.5fr)_repeat(3,minmax(0,1fr))] gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16 justify-self-end" />
        <Skeleton className="h-4 w-16 justify-self-end" />
        <Skeleton className="h-4 w-16 justify-self-end" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(0,2.5fr)_repeat(3,minmax(0,1fr))] items-center gap-3 px-4 py-4"
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 max-w-full" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="h-4 w-16 justify-self-end" />
            <Skeleton className="h-4 w-16 justify-self-end" />
            <Skeleton className="h-4 w-16 justify-self-end" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListRowSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-xl border border-border bg-background p-3",
        compact && "p-2.5"
      )}
    >
      <div className="min-w-0 space-y-2">
        <Skeleton className={cn("w-32 max-w-full", compact ? "h-4" : "h-5")} />
        <Skeleton className={cn("w-24 max-w-full", compact ? "h-3" : "h-4")} />
      </div>
      <div className="flex shrink-0 items-end gap-2">
        <Skeleton className={cn("w-16", compact ? "h-4" : "h-5")} />
        <Skeleton className={cn("w-12", compact ? "h-4" : "h-5")} />
      </div>
    </div>
  );
}

function MetricTile() {
  return (
    <div className="rounded-2xl border border-border bg-background p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="size-4 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-7 w-24 max-w-full" />
      <Skeleton className="mt-2 h-3.5 w-20 max-w-full" />
    </div>
  );
}

function MiniStatCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-3 shadow-sm">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className={cn("mt-2 max-w-full", compact ? "h-5 w-20" : "h-6 w-28")} />
      <Skeleton className="mt-2 h-3.5 w-20 max-w-full" />
    </div>
  );
}

function LoadingCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      {children}
    </div>
  );
}

function inferVariant(message: string): PageLoadingVariant {
  const normalized = message.toLowerCase();

  if (normalized.includes("fundamentals")) return "fundamentals";
  if (normalized.includes("funds daily returns report")) return "strategy";
  if (normalized.includes("sector performance")) return "sector-list";
  if (normalized.includes("sector")) return normalized.includes("stock") ? "sector-detail" : "sector-detail";
  if (normalized.includes("dashboard")) return "dashboard";
  if (normalized.includes("portfolio")) return normalized.includes("portfolios") ? "portfolio" : "portfolio-detail";
  if (normalized.includes("stock")) return "stock";
  if (normalized.includes("market data")) return "market";
  if (normalized.includes("market")) return normalized.includes("global") ? "global-market" : "market";
  if (normalized.includes("mutual funds") || normalized.includes("etfs")) return "list";
  if (normalized.includes("watchlist") || normalized.includes("alerts")) return "list";
  if (normalized.includes("youtubers")) return "list";
  if (normalized.includes("admin") && normalized.includes("user")) return "admin-user";
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("board meetings") || normalized.includes("book closures") || normalized.includes("dividend") || normalized.includes("pivot points")) {
    return "list";
  }

  return "default";
}
