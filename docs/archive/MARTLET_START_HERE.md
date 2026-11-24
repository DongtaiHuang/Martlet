> **Archived.** This file records the original hackathon starter instructions (an overlay for `create-next-app`). They no longer apply: the repository is a complete app. To run it, follow the [README](../../README.md#run-locally).

# McGill Martlet — Four-person 24-hour starter

This is an **overlay** for the official Next.js `with-supabase` starter, not a complete standalone Next.js project. It intentionally provides a working **mock feed** and a demo map, with clear ownership boundaries so four people can build in parallel.

## 0. One person initializes the project

```powershell
npx create-next-app -e with-supabase mcgill-martlet
cd mcgill-martlet
npm install maplibre-gl lucide-react zod
```

Extract `martlet-team-starter.zip` to a separate folder. In PowerShell, from the Next.js project root, copy its contents into the project:

```powershell
Copy-Item -Path "..\martlet_overlay\*" -Destination "." -Recurse -Force
```

Replace `..\martlet_overlay` with the actual extracted folder path. Do not overwrite `lib/supabase` or the starter's auth setup; this overlay does not include those files.

Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to `.env.local` from your Supabase project. The optional `NEXT_PUBLIC_MAP_STYLE_URL` should point to a licensed MapLibre style JSON. With no style set, the map uses MapLibre's **demo** tiles (development only, not production).

```powershell
npm run dev
```

Verify `/meetups` renders sample cards and `/explore` shows sample markers.

## 1. Before branching, commit shared contracts

Commit these unchanged files to `main` first:
- `types/meetup.ts`
- `lib/locations.ts`
- `docs/TEAM_PLAN.md`
- `docs/CONTRACTS.md`
- The baseline mock screens and SQL migration

Then every developer checks out the same commit and creates a personal branch.

```bash
git checkout -b feature/social-feed
# teammates use feature/meetup-creation, feature/supabase-auth, feature/map-interactions
```

## 2. Shared service contracts

Developer 3 implements `lib/meetups.ts` (currently serves mock data). Developer 4 implements `lib/social.ts` (not yet present). Use the function signatures in `docs/CONTRACTS.md`.

## 3. What this starter is NOT

It does not implement authentication flows, real database calls, live interactions, production map styles, or full moderation. The included SQL migration provides a starting schema/RLS; run it in Supabase before integrating. See `docs/TEAM_PLAN.md` for the order and test cases.

## 4. Safety

Public campus landmarks only, no exact live student locations. Never put a Supabase service-role secret in a `NEXT_PUBLIC_` variable. Do not deploy without confirming RLS and permitted map tile usage.
