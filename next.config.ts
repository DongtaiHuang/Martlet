import type { NextConfig } from "next";

if (process.env.VERCEL_ENV === "production") {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) {
    if (!process.env[name]?.trim()) throw new Error(`${name} is required for Vercel production.`);
  }
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!.trim();
  if (!key.startsWith("sb_publishable_")) {
    let role: unknown;
    try {
      role = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role;
    } catch {
      // Only a Supabase publishable key or legacy anon JWT belongs in the browser.
    }
    if (role !== "anon") throw new Error("Use a Supabase publishable or legacy anon key in production.");
  }
  // Unset styles use OpenFreeMap. The demo tiles have no campus detail.
  for (const name of ["NEXT_PUBLIC_MAP_STYLE_URL", "NEXT_PUBLIC_MAP_STYLE_URL_DARK"]) {
    if (process.env[name]?.toLowerCase().includes("demotiles.maplibre.org")) {
      throw new Error(`${name} must not use MapLibre demo tiles in production.`);
    }
  }
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
