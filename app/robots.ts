import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

/**
 * Crawl policy for Stockli.
 *
 * Public market/tool pages are indexable. `/api/public/*` is explicitly allowed
 * so Googlebot can fetch the JSON that hydrates client market boards.
 * Personal, admin, and private API routes stay blocked.
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
          "/api/public/",
          "/llms.txt",
        ],
        disallow: [
          "/dashboard",
          "/portfolios",
          "/watchlist",
          "/alerts",
          "/account",
          "/admin",
          "/api/",
          "/api/private/",
          "/api/cron/",
          "/api/notifications/",
          "/api/auth/",
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
