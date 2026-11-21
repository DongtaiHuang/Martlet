export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

/**
 * "live" when Supabase credentials are present, otherwise "mock".
 * The whole app is in exactly one mode: live mode never falls back to mock data,
 * and mock mode never touches Supabase.
 */
export type DataMode = "live" | "mock";

export function getDataMode(): DataMode {
  return getSupabaseConfig() ? "live" : "mock";
}
