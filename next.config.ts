import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The with-supabase starter enables cacheComponents, but the Martlet overlay
  // pages (mock feed using Date.now(), async data without Suspense) were not
  // written for it. Re-enable once pages are adapted.
  cacheComponents: false,
};

export default nextConfig;
