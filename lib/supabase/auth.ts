import { getSupabaseConfig } from "./env";
import { createClient } from "./server";

export interface CurrentUser {
  id: string;
  email: string | null;
  display_name: string;
}

export class AuthRequiredError extends Error {
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

/**
 * Returns the signed-in user, verified with Supabase Auth (getClaims validates the JWT),
 * or null when signed out or in mock mode. Server-only.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!getSupabaseConfig()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", claims.sub)
    .maybeSingle<{ display_name: string }>();

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    display_name: profile?.display_name ?? "Martlet Student",
  };
}

/** Like getCurrentUser, but throws AuthRequiredError when nobody is signed in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}
