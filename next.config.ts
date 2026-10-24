import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Node-only packages: Remotion's renderer spawns Chrome + its compositor binary,
  // Playwright drives a browser. Load them with plain require, never bundle them.
  serverExternalPackages: [
    "@remotion/renderer",
    "@remotion/bundler",
    "playwright",
    "playwright-core",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
