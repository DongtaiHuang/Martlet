import type { NextConfig } from "next";

// Fail Vercel production builds that would ship without a licensed map style
// (demo tiles are development-only). See docs/DEPLOYMENT.md.
if (process.env.VERCEL_ENV === "production") {
  const style = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "";
  if (!style || style.includes("demotiles.maplibre.org")) {
    throw new Error("Set NEXT_PUBLIC_MAP_STYLE_URL to a licensed MapLibre style for production (not demo tiles).");
  }
}

const nextConfig: NextConfig = {};

export default nextConfig;
