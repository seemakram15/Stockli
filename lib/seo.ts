import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
import { config } from "@/lib/config";

/** Primary SEO keywords for Stockli (PSX + multi-market portfolio SaaS). */
export const SEO_KEYWORDS = [
  "Stockli",
  "mystockli",
  "PSX portfolio tracker",
  "Pakistan stock exchange",
  "KSE 100 live",
  "PSX share price",
  "Pakistan mutual funds",
  "MUFAP funds tracker",
  "PSX stock analysis",
  "portfolio tracker Pakistan",
  "Shariah stocks Pakistan",
  "KMI All Share",
  "FIPI LIPI",
  "stock fundamentals Pakistan",
  "crypto and commodities tracker",
] as const;

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export const PUBLIC_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export function absoluteUrl(path = "/") {
  const base = config.siteUrl.replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = [...SEO_KEYWORDS],
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  index?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path },
    robots: index ? PUBLIC_ROBOTS : PRIVATE_ROBOTS,
    openGraph: {
      type: "website",
      url,
      siteName: APP_NAME,
      title: `${title} · ${APP_NAME}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${APP_NAME}`,
      description,
    },
  };
}

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    name: APP_NAME,
    url: config.siteUrl,
    logo: absoluteUrl("/icons/icon-512.png"),
    sameAs: [] as string[],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "seemakram15@gmail.com",
      availableLanguage: ["English", "Urdu"],
    },
  };
}

export function websiteJsonLd(description: string) {
  return {
    "@type": "WebSite",
    name: APP_NAME,
    url: config.siteUrl,
    description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${config.siteUrl}/stock/{search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationJsonLd(description: string) {
  return {
    "@type": "SoftwareApplication",
    name: APP_NAME,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, iOS, Android, Desktop",
    url: config.siteUrl,
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "PSX live market data",
      "Portfolio tracking",
      "Mutual funds and ETFs",
      "Stock fundamentals",
      "Watchlists and price alerts",
    ],
  };
}

export function stockPageJsonLd({
  symbol,
  company,
  description,
}: {
  symbol: string;
  company?: string | null;
  description: string;
}) {
  return {
    "@type": "Corporation",
    name: company || symbol,
    tickerSymbol: symbol,
    url: absoluteUrl(`/stock/${symbol}`),
    description,
    addressCountry: "PK",
  };
}
