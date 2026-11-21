# 0002. Next.js + Supabase starter overlay

- **Status:** Accepted
- **Date:** 2026-11-21

## Context

The team needs authentication, a Postgres database, and a deployable web app within 24 hours. Building auth and project scaffolding from scratch would take time better spent on features.

## Decision

- Use the official Next.js `with-supabase` example (`npx create-next-app -e with-supabase`) as the base: App Router, TypeScript, Tailwind CSS, and Supabase SSR auth.
- This repository is an **overlay** of Martlet-specific files (`app/`, `components/`, `lib/`, `types/`, `supabase/`, `docs/`) copied on top of that starter. The overlay doesn't modify the starter's `lib/supabase` or auth routes.
- Additional dependencies: `maplibre-gl`, `lucide-react`, `zod`.
- Deploy to Vercel.

## Consequences

- Auth, session handling, and Supabase clients come pre-built and maintained upstream.
- The repo as first committed doesn't run on its own. Someone must generate the starter and merge it once, then commit the combined result so every branch starts from a runnable baseline.
- Overlay files win on conflict (e.g. `app/page.tsx` redirects to `/meetups`), so the starter's landing page is replaced.
- The project is coupled to the starter's conventions (env var names such as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, file layout).
