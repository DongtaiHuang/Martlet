import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/env";

// Pages reachable without a session. Guests can browse meetups, landmarks, the map and the game
// read-only (ADR 0025); every action still needs a session (server actions + RLS check it).
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/landmarks", "/explore", "/play", "/achievements"];
// Meetup pages guests may read; /meetups/new and /meetups/<id>/edit still need sign-in.
const PUBLIC_EXACT = /^\/(?:meetups(?:\/[0-9a-f-]{36})?)?$/i;

function isPublicPath(pathname: string) {
  return PUBLIC_EXACT.test(pathname) || PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const supabaseConfig = getSupabaseConfig();
  let response = NextResponse.next({ request });
  // Mock mode: no auth, no redirects.
  if (!supabaseConfig) return response;

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // Refreshes the session cookie and verifies the JWT.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!signedIn && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    const redirect = NextResponse.redirect(loginUrl);
    // Keep any cookie changes (e.g. a cleared expired session) on the redirect.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  // Public build assets must keep their original content type and avoid session redirects.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|maplibre-gl-worker\\.mjs$|mediapipe/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
