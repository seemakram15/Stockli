"use client";

import * as React from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowUp, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { APP_NAME } from "@/lib/constants";

type FooterLink = { label: string; href: string };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Markets",
    links: [
      { label: "PSX stock market", href: "/market" },
      { label: "Sector performance", href: "/market/sectors" },
      { label: "Mutual funds", href: "/market/mutual-funds" },
      { label: "Exchange traded funds", href: "/market/etfs" },
      { label: "US S&P 500", href: "/market/us" },
      { label: "India market", href: "/market/india" },
    ],
  },
  {
    title: "Portfolio",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Portfolios", href: "/portfolios" },
      { label: "Watchlist", href: "/watchlist" },
      { label: "Price alerts", href: "/alerts" },
      { label: "World view", href: "/market/world" },
      { label: "Crypto & oil", href: "/market/crypto" },
    ],
  },
  {
    title: "Tools & explore",
    links: [
      { label: "Stock analyzer", href: "/analysis/stock-analyzer" },
      { label: "Fundamentals", href: "/analysis/fundamentals" },
      { label: "Pivot points", href: "/analysis/pivot-points" },
      { label: "Board meetings", href: "/explore/board-meetings" },
      { label: "Dividend history", href: "/explore/dividend-history" },
      { label: "Market videos", href: "/youtubers" },
    ],
  },
];

export function SiteFooter() {
  const reduce = useReducedMotion();
  const year = 2026;

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <footer className="relative isolate overflow-hidden border-t border-white/10 bg-[#04100d] text-white">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[60%] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />

      {/* Giant brand wordmark — background layer behind the footer items */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex select-none justify-center overflow-hidden" aria-hidden>
        <span className="translate-y-[20%] bg-gradient-to-b from-white/[0.08] to-white/[0.015] bg-clip-text text-[24vw] font-bold uppercase leading-none tracking-tighter text-transparent">
          {APP_NAME}
        </span>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          {/* Brand */}
          <div>
            <Logo className="text-white" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
              {APP_NAME} is a free, installable command center for tracking PSX and
              global markets — live P/L, daily gain/loss calendars, funds, fundamentals,
              watchlists and alerts in one fast workspace.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="size-3.5" />
              Per-user access · row-level security
            </span>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">
                  {column.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-white/65 underline-offset-4 transition-colors hover:text-emerald-200 hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* Disclaimer band */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm leading-6 text-white/60 backdrop-blur-sm sm:p-6">
          <p className="font-medium text-white/80">
            For personal use. Market data may be delayed. Not investment advice.
          </p>
          <p className="mt-2">
            Market data comes from the public PSX Data Portal (dps.psx.com.pk) and other
            public sources, and is typically delayed ~15 minutes. Figures are shown in PKR
            and provided as-is for non-commercial, informational use only — always verify
            with an official source before trading.
          </p>
        </div>

        {/* Bottom row */}
        <div className="relative z-10 mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/10 py-7 text-sm text-white/55 sm:flex-row">
          <p>
            © {year} {APP_NAME}. Built for investors who like to stay ready.
          </p>
          <button
            type="button"
            onClick={scrollTop}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-emerald-300/40 hover:text-emerald-100"
          >
            <ArrowUp className="size-4" />
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}
