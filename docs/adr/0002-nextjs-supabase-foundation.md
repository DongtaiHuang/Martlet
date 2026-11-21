# 0002. Next.js + Supabase foundation

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The team needs authentication, a Postgres database, and a deployable web app within 24 hours. The original starter was an overlay meant to be copied onto the official Next.js `with-supabase` example, which also ships a full set of demo auth pages, shadcn/ui components, and a Tailwind v3 theme the app doesn't need.

## Decision

- Stack: Next.js App Router (v16), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres, Auth, Realtime), MapLibre GL JS, `zod`, `lucide-react`. Node.js 22.13+. Deploy to Vercel.
- Follow the `with-supabase` example's **Supabase SSR pattern** rather than copying the whole example (PR #1):
  - `lib/supabase/client.ts` and `lib/supabase/server.ts` create browser/server clients.
  - `lib/supabase/env.ts` reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and returns `null` when unset.
  - `proxy.ts` refreshes the session on each request and is a no-op without Supabase config.
- The app runs without a Supabase project: the feed and map read mock data until services are wired up.
- Sign-in/sign-up screens are built by the auth owner (Developer 3) rather than imported from the example.

## Consequences

- Small, readable baseline with no unused demo UI or theme.
- Anyone can clone, `npm ci`, and `npm run dev` without credentials.
- Auth UI is still to be built; the example's pages can be used as a reference.
- The project follows the starter's env var names and SSR conventions, so upstream Supabase docs apply directly.
