import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BellRing,
  CalendarRange,
  Globe2,
  LineChart,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
};

const PERKS = [
  { icon: Globe2, tint: "text-sky-300", ring: "ring-sky-300/30 bg-sky-300/10", title: "Every market in one place", desc: "PSX, US, funds, ETFs, oil, commodities & crypto." },
  { icon: CalendarRange, tint: "text-emerald-300", ring: "ring-emerald-300/30 bg-emerald-300/10", title: "Live P/L & daily calendars", desc: "Day and total P/L with a persistent gain/loss calendar." },
  { icon: LineChart, tint: "text-violet-300", ring: "ring-violet-300/30 bg-violet-300/10", title: "Fundamentals & AI analyzer", desc: "Statements, ratios, peer comparison and AI insights." },
  { icon: BellRing, tint: "text-amber-300", ring: "ring-amber-300/30 bg-amber-300/10", title: "Watchlists & price alerts", desc: "Follow symbols and get above/below alerts each refresh." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Branded panel */}
      <aside className="relative hidden overflow-hidden bg-[#04100d] text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -left-24 -top-24 size-[34rem] rounded-full bg-emerald-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-1/3 size-[26rem] rounded-full bg-sky-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] left-1/3 size-[28rem] rounded-full bg-violet-500/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-grid-faint opacity-50 [mask-image:radial-gradient(80%_70%_at_30%_20%,black,transparent)]" />

        <div className="relative z-10 flex flex-1 flex-col p-10 xl:p-12">
          <Link href="/" aria-label={`${APP_NAME} home`} className="w-fit">
            <Logo className="text-white" />
          </Link>

          <div className="mt-auto max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <Sparkles className="size-3.5" />
              Your all-market portfolio workspace
            </span>
            <h2 className="mt-5 text-balance text-4xl font-semibold leading-tight tracking-tight">
              Track every market move on{" "}
              <span className="text-gradient-brand">{APP_NAME}</span>.
            </h2>

            <ul className="mt-8 space-y-4">
              {PERKS.map((perk) => (
                <li key={perk.title} className="flex items-start gap-3">
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ${perk.ring}`}>
                    <perk.icon className={`size-5 ${perk.tint}`} />
                  </span>
                  <div>
                    <p className="font-medium text-white">{perk.title}</p>
                    <p className="text-sm text-white/60">{perk.desc}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-10 inline-flex items-center gap-2 text-xs text-white/55">
              <ShieldCheck className="size-4 text-emerald-300" />
              Per-user access · row-level security · data delayed ~10 min
            </p>
          </div>
        </div>
      </aside>

      {/* Form area */}
      <div className="relative flex min-h-screen flex-col bg-background">
        {/* Soft brand wash so the form side feels part of the same world. */}
        <div className="pointer-events-none absolute inset-0 bg-brand-mesh-faint opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-grid-faint opacity-[0.04] dark:opacity-[0.06] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />

        <header className="relative z-10 flex items-center justify-between px-4 py-5 sm:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
          <div className="flex items-center gap-2">
            <span className="lg:hidden">
              <Logo />
            </span>
            <ThemeToggle />
          </div>
        </header>
        <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="relative z-10 flex items-center justify-center gap-2 px-4 pb-6 text-xs text-muted-foreground sm:px-8">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          Secure accounts · row-level security · data delayed ~10 min
        </footer>
      </div>
    </div>
  );
}
