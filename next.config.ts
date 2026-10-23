import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local dev database) ships WASM and data files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // No remote or user images: the image optimizer stays off, removing its attack surface.
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
