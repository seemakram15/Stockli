"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ServiceWorkerRegister />
      <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
    </NextThemesProvider>
  );
}
