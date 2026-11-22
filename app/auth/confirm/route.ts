import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/supabase/redirect";

// Target of the sign-up confirmation email. Supports both the default PKCE link (?code=)
// and a custom email template that sends ?token_hash=&type=.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));
  const redirectTo = (path: string) => {
    const target = new URL(path, request.url);
    // Keep the browser on the exact origin where its authentication cookies were set.
    const location = safeRedirectPath(`${target.pathname}${target.search}${target.hash}`);
    return new NextResponse(null, { status: 307, headers: { location } });
  };
  const fail = (reason: string) =>
    redirectTo(`/login?error=${encodeURIComponent(reason)}`);

  if (!getSupabaseConfig()) return fail("Supabase is not configured.");

  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(next);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(next);
  }

  return fail("That confirmation link is invalid or has expired. Try signing in, or sign up again.");
}
