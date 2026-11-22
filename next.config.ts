import type { NextConfig } from "next";

// Demo tiles are development-only (and useless at campus zoom); block them in
// Vercel production. Unset falls back to OpenFreeMap. See docs/DEPLOYMENT.md.
if (process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_MAP_STYLE_URL?.includes("demotiles.maplibre.org")) {
  throw new Error("NEXT_PUBLIC_MAP_STYLE_URL must not use MapLibre demo tiles in production.");
}

const nextConfig: NextConfig = {
  // Dev only: let other devices on the LAN (e.g. a phone) load dev assets.
  // DEV_ALLOWED_ORIGINS=10.121.186.72 npm run dev -- -H 0.0.0.0 --experimental-https
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [],
  experimental: {
    serverActions: {
      // Landmark photos (ADR 0009) are resized in the browser to well under 1 MB; this is
      // headroom for multipart overhead, kept below Vercel's 4.5 MB request limit.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
