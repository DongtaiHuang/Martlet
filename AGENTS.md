<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Martlet agent guide

McGill campus meetup app (hackathon, 24h). Next.js 16 App Router, React 19, TS, Tailwind v4, Supabase, MapLibre. Keep changes small and focused; don't refactor beyond the task.

## Before you push
`npm ci` once, then `npx tsc --noEmit && npm run lint && npm test && npm run build` (CI also runs the browser and database tests; see README "Quality checks"). Don't merge with CI red. Every migration needs a SQL test in `tests/` that passes `npm run test:db` on a fresh database.

## Commits
Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`, `test:`. One logical change per commit, imperative subject ≤72 chars. Never commit `.env*` (except `.env.example`) or secrets.

## Branches & PRs
- Branch from latest `main`; names per `docs/TEAM_PLAN.md` (`feature/social-feed`, `feature/meetup-creation`, `feature/supabase-auth`, `feature/map-interactions`) or `fix/…`, `docs/…`, `chore/…`.
- Small PRs into `main`. Body: Summary, Testing (what you actually ran), Follow-ups.
- Sync with `main` every 3–4h. Rebase only your own branch (`--force-with-lease`); never force-push shared branches or `main`.

## Ownership
See `docs/TEAM_PLAN.md`. Don't edit another developer's files without coordinating; note it in the PR if you must.

## Contracts & decisions
- Keep signatures in `docs/CONTRACTS.md` and types in `types/meetup.ts` stable; components call `lib/` services, not Supabase directly.
- Decisions live in `docs/adr/`. Changing one needs a new ADR.

## Security (non-negotiable)
- No service-role key in `NEXT_PUBLIC_*` or client code.
- Never accept `userId` from the browser; use the Supabase session.
- RLS (`supabase/migrations/`) is the real authorization; UI checks are UX only.
- Mapped meetup locations must come from the approved catalogs. Custom meetup locations store meeting instructions without coordinates (ADR 0017). The map's "show my location" stays in the browser; never send, store or share a user's position (ADR 0008).
