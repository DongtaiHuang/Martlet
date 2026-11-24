# 0028. CI test gates for production

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

After the hackathon, Martlet is moving to production. CI ran the type check, lint, contrast check, build and a Docker smoke test, but none of the tests in `tests/`. There was no `test` script, and the SQL tests could only be run by hand on a disposable database. Two SQL tests had silently broken (a PL/pgSQL name clash, and a ranking tie-break that depended on distinct timestamps). Migrations reached production only through the SQL Editor, so nothing proved they apply in order on a fresh database, even though RLS (ADR 0003) is the real authorization boundary.

## Decision

Every pull request and every push to `main` must pass:

- **Unit tests:** `npm test` runs `tests/*.test.mjs` with Node's built-in runner. These tests import TypeScript directly, so the minimum Node version is 22.18 (type stripping without flags).
- **Browser tests:** `npm run test:e2e` runs `tests/*.browser.mjs` with Playwright against a demo-mode production build, so no secrets are needed.
- **Database:** CI starts a throwaway Supabase stack with the Supabase CLI. `scripts/test-database.sh` applies every file in `supabase/migrations/` in filename order, then runs each `tests/*.sql`. The script refuses non-local database URLs.
- **Security:** CodeQL (`security-extended`) on pull requests, on `main` and weekly. Dependabot sends weekly grouped npm and GitHub Actions updates.

Production stays on Vercel, and the release and rollback process in `docs/RELEASES.md` is unchanged. Production migrations are still applied by the database owner after a backup. CI only proves they apply cleanly to a fresh database.

## Consequences

- New migrations need a SQL test, and both must pass on a fresh database before merging.
- CI takes a few minutes longer (Chromium install and Supabase image pulls).
- The database job checks a fresh database, not an existing one. Migrations that are only safe on a fresh project, such as `001_mvp.sql`, still need the manual checks in `docs/SUPABASE_SETUP.md`.
- Admin-only settings (branch protection requiring these checks, secret scanning, a staging Supabase project for Previews, backups, monitoring) are listed in `docs/DEPLOYMENT.md` and need a repository or project owner.
- Follow-ups: move migrations to Supabase CLI timestamped names so `supabase db push` can track them, and add error tracking once the team has an account.
