import type { NextConfig } from "next";

// Demo tiles are development-only (and useless at campus zoom); block them in
// Vercel production. Unset falls back to OpenFreeMap. See docs/DEPLOYMENT.md.
if (process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_MAP_STYLE_URL?.includes("demotiles.maplibre.org")) {
  throw new Error("NEXT_PUBLIC_MAP_STYLE_URL must not use MapLibre demo tiles in production.");
}

const nextConfig: NextConfig = {
  // Docker builds a self-contained server (Dockerfile sets NEXT_OUTPUT=standalone); Vercel ignores this.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  experimental: {
    serverActions: {
      // Landmark photos (ADR 0009) are resized in the browser to well under 1 MB; this is
      // headroom for multipart overhead, kept below Vercel's 4.5 MB request limit.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
