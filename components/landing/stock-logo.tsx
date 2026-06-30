"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Official websites for liquid PSX names → used to pull a real company logo
 * from Clearbit. Unknown symbols (or a 404 from Clearbit) fall back to a
 * colourful monogram, so the row always renders something tidy.
 */
const DOMAINS: Record<string, string> = {
  OGDC: "ogdcl.com", PPL: "ppl.com.pk", MARI: "mpcl.com.pk", POL: "pakoil.com.pk",
  PSO: "psopk.com", APL: "apl.com.pk", ATRL: "arl.com.pk", NRL: "nrlpak.com",
  PRL: "prl.com.pk", SHEL: "shell.com.pk", SNGP: "sngpl.com.pk", SSGC: "ssgc.com.pk",
  HUBC: "hubpower.com", KAPCO: "kapco.com.pk", ENGRO: "engro.com", EPCL: "engropolymer.com",
  EFERT: "engrofertilizers.com", FFC: "ffc.com.pk", FATIMA: "fatima-group.com",
  LUCK: "lucky-cement.com", DGKC: "dgcement.com", MLCF: "mlcf.com.pk", FCCL: "fccl.com.pk",
  CHCC: "checement.com", KOHC: "kohatcement.com", PIOC: "pioneercement.com",
  HBL: "hbl.com", UBL: "ubldirect.com", MCB: "mcb.com.pk", NBP: "nbp.com.pk",
  BAHL: "bankalhabib.com", BAFL: "bankalfalah.com", MEBL: "meezanbank.com",
  AKBL: "askaribank.com.pk", FABL: "faysalbank.com", BOP: "bop.com.pk", ABL: "abl.com",
  HMB: "habibmetro.com", TRG: "trgpakistan.com", SYS: "systemsltd.com",
  AVN: "avanceon.com", NETSOL: "netsoltech.com", PTC: "ptcl.com.pk",
  ILP: "interloop-pk.com", NML: "nishatmillsltd.com", GATM: "gulahmed.com",
  SEARL: "searlecompany.com", AGP: "agp.com.pk", GLAXO: "gsk.com", ABOT: "abbott.com.pk",
  HINOON: "highnoon-labs.com", COLG: "colgate.com.pk", NESTLE: "nestle.pk",
  PAEL: "pakelektron.com", INDU: "toyota-indus.com", HCAR: "honda.com.pk",
  PSMC: "paksuzuki.com.pk", MTL: "millat.com.pk", PKGS: "packages.com.pk",
  ASTL: "amrelisteels.com", ISL: "intlsteels.com", MUGHAL: "mughalsteel.com",
  LOTCHEM: "lottechem.com.pk", BERGER: "bergerpaints.com.pk",
};

/** Symbols we can show a real company logo for — used to curate the leaderboard. */
export const LOGO_SYMBOLS: ReadonlySet<string> = new Set(Object.keys(DOMAINS));

export function StockLogo({ symbol, up }: { symbol: string; up: boolean }) {
  const key = symbol.toUpperCase();
  const domain = DOMAINS[key];
  // "idle" → show monogram while loading; "loaded" → fade the real logo in;
  // "failed" → keep the monogram. This means a broken/slow logo never shows
  // a broken-image icon — it just stays a tidy colourful monogram.
  const [status, setStatus] = React.useState<"idle" | "loaded" | "failed">("idle");

  return (
    <span
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-xs font-bold",
        up
          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
          : "bg-rose-500/12 text-rose-600 dark:text-rose-300"
      )}
    >
      {key.slice(0, 2)}
      {domain && status !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt={`${symbol} logo`}
          loading="lazy"
          className={cn(
            "absolute inset-0 size-full rounded-lg bg-white object-contain p-1 transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0"
          )}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
        />
      )}
    </span>
  );
}
