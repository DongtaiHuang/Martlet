import type { NextConfig } from "next";

// Demo tiles are development-only (and useless at campus zoom); block them in
// Vercel production. Unset falls back to OpenFreeMap. See docs/DEPLOYMENT.md.
if (process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_MAP_STYLE_URL?.includes("demotiles.maplibre.org")) {
  throw new Error("NEXT_PUBLIC_MAP_STYLE_URL must not use MapLibre demo tiles in production.");
}

const nextConfig: NextConfig = {};

export default nextConfig;
