import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/portfolios",
          "/market",
          "/analysis",
          "/explore",
          "/watchlist",
          "/alerts",
          "/youtubers",
          "/admin",
          "/api",
          "/auth",
        ],
      },
    ],
    sitemap: `${config.siteUrl}/sitemap.xml`,
    host: config.siteUrl,
  };
}
