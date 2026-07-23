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

const DEFAULT_OG_IMAGE = {
  url: "/landing/market-command-center.webp",
  width: 1600,
  height: 900,
  alt: `${APP_NAME} market workspace`,
} as const;

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
  if (!path || path === "/") return `${base}/`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPageMetadata({
  title,
  description,
  path,
  keywords = [...SEO_KEYWORDS],
  index = true,
  ogType = "website",
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  index?: boolean;
  ogType?: "website" | "article" | "profile";
}): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = `${title} · ${APP_NAME}`;
  return {
    title,
    description,
    keywords,
    alternates: { canonical: path === "/" ? "/" : path },
    robots: index ? PUBLIC_ROBOTS : PRIVATE_ROBOTS,
    openGraph: {
      type: ogType,
      url,
      siteName: APP_NAME,
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE],
      locale: "en_PK",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${config.siteUrl}/#organization`,
    name: APP_NAME,
    alternateName: ["mystockli", "My Stockli"],
    url: config.siteUrl,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icons/icon-512.png"),
      width: 512,
      height: 512,
    },
    image: absoluteUrl("/landing/market-command-center.webp"),
    sameAs: [] as string[],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "seemakram15@gmail.com",
      availableLanguage: ["English", "Urdu"],
    },
    areaServed: {
      "@type": "Country",
      name: "Pakistan",
    },
  };
}

export function websiteJsonLd(description: string) {
  return {
    "@type": "WebSite",
    "@id": `${config.siteUrl}/#website`,
    name: APP_NAME,
    url: config.siteUrl,
    description,
    publisher: { "@id": `${config.siteUrl}/#organization` },
    inLanguage: "en-PK",
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
    offers: { "@type": "Offer", price: "0", priceCurrency: "PKR" },
    featureList: [
      "PSX live market data",
      "Portfolio tracking",
      "Mutual funds and ETFs",
      "Stock fundamentals",
      "Watchlists and price alerts",
    ],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
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
  const path = `/stock/${symbol}`;
  return {
    "@type": "Corporation",
    name: company || symbol,
    tickerSymbol: symbol,
    url: absoluteUrl(path),
    description,
    addressCountry: "PK",
    brand: { "@id": `${config.siteUrl}/#organization` },
  };
}

export function faqPageJsonLd(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/** Default FAQs for the marketing homepage. */
export const LANDING_FAQS = [
  {
    question: "What is Stockli?",
    answer:
      "Stockli is a Pakistan-focused investing workspace for tracking PSX share prices, KSE-100, mutual funds, ETFs, portfolios, watchlists, and stock fundamentals in one place.",
  },
  {
    question: "Can I browse PSX market data without signing up?",
    answer:
      "Yes. Public market pages, stock profiles, news, and analysis tools are available for guests. Create a free account when you want portfolios, alerts, and saved watchlists.",
  },
  {
    question: "Does Stockli cover only the Pakistan Stock Exchange?",
    answer:
      "PSX is the core focus, including live prices, sectors, funds, and FIPI/LIPI. Stockli also tracks US, India, world indexes, oil, commodities, and crypto for broader context.",
  },
] as const;
