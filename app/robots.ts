import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/**
 * Crawl policy for Stockli.
 *
 * Public market/tool pages are indexable (guest browsing must stay enabled in
 * production so crawlers can render them). Personal and admin areas stay blocked.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/market",
          "/stock",
          "/analysis",
          "/explore",
          "/news",
          "/youtubers",
          "/icons/",
          "/landing/",
        ],
        disallow: [
          "/dashboard",
          "/portfolios",
          "/watchlist",
          "/alerts",
          "/account",
          "/admin",
          "/api/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/auth/",
          "/search",
        ],
      },
    ],
    sitemap: `${config.siteUrl}/sitemap.xml`,
    host: config.siteUrl,
  };
}
