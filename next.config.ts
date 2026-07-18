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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
