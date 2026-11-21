import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function getMeetupViewer() {
  if (!getSupabaseConfig()) return null;

  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error && !isAuthSessionMissingError(error)) throw error;
  return data?.claims.sub ?? null;
}
