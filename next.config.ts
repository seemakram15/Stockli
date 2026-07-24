import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf"],
  // Pin the workspace root explicitly — a stray package-lock.json in the
  // home directory otherwise makes Turbopack infer the wrong root and
  // intermittently fail to resolve newly added files under @/*.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Rewrites barrel imports (e.g. `import { X } from "lucide-react"`) to
    // per-module imports at build time, so pages only ship the icons/pieces
    // they actually use instead of the whole package.
    optimizePackageImports: ["lucide-react", "recharts", "radix-ui"],
  },
  async redirects() {
    return [
      { source: "/admin", destination: "/control-panel/users", permanent: true },
      {
        source: "/admin/users/:id",
        destination: "/control-panel/users/:id",
        permanent: true,
      },
      {
        source: "/admin/fund-holdings",
        destination: "/control-panel/edit-funds-holdings",
        permanent: true,
      },
      {
        source: "/admin/customisation",
        destination: "/control-panel/lock-public-pages",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
