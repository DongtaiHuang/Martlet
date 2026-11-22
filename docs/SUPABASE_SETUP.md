# Supabase setup (development)

Martlet runs in one of two **data modes**, chosen from the environment at build/start time:

| Mode | When | Behavior |
| --- | --- | --- |
| `mock` | `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` missing | Feed/map show `lib/mock-meetups.ts`. No auth, no redirects. `createMeetup` / `cancelMeetup` throw `MockModeError`. Login page shows a "Demo mode" notice. |
| `live` | Both variables set | Every read/write goes to Supabase. Errors are thrown, never replaced by mock data. All pages except `/login`, `/signup`, `/auth/*` require sign-in. |

Check the mode in code with `getMeetupDataMode()` from `lib/meetups.ts` (or `getDataMode()` from `lib/supabase/env.ts`).

## 1. Create the project

1. Create a project at <https://supabase.com/dashboard> (free tier is fine).
2. **Project Settings → API Keys**: copy the project URL and the **publishable** key (`sb_publishable_…`).
   Never use the `service_role`/secret key in this app.
3. Copy `.env.example` to `.env.local` and fill in the two `NEXT_PUBLIC_SUPABASE_*` values. Share them with teammates privately, not in Git.

## 2. Apply migrations (in order)

In **SQL Editor**, paste and run each file once:

1. `supabase/migrations/001_mvp.sql` (schema, profile trigger, base RLS). Only on a fresh project, since it is not re-runnable.
2. `supabase/migrations/002_security_hardening.sql` (RLS/privilege hardening, approved campus locations). Safe to re-run.
3. `supabase/migrations/003_more_campus_locations.sql` (additional downtown campus meetup locations). Safe to re-run.
4. `supabase/migrations/004_backfill_profiles.sql` (profiles for accounts created before `001` ran). Safe to re-run.
5. `supabase/migrations/005_table_grants.sql` (explicit table privileges; newer Supabase projects don't auto-grant them, causing `permission denied`). Safe to re-run.
6. `supabase/migrations/006_landmarks.sql` (ADR 0009: landmarks, photo unlocks, and the private `landmark-photos` Storage bucket with its policies). Safe to re-run. Landmark coordinates are approximate; check them on the map and keep `lib/mock-landmarks.ts` in sync.
7. `supabase/migrations/007_meetup_polls.sql` (advisory meetup polls). After 001–006 are applied, open a new SQL Editor query, paste the full 007 file, and run it once before deploying the poll UI.

`002` adds a foreign key from `meetups(location_name, latitude, longitude)` to `campus_locations`. If the project already holds meetups at non-approved coordinates, it will fail; cancel/delete those rows first (Table editor) and re-run.

**When adding a campus location**, update `lib/locations.ts` and create a new idempotent migration to insert the matching canonical name and coordinates in `public.campus_locations`; then run it in Supabase. Do not rewrite migrations that teammates may have already applied.

**Sign-in not available?** In local mock mode (without both `NEXT_PUBLIC_SUPABASE_*` variables), the nav still exposes `/login` and `/signup` for discovery, but account creation and meetup publishing are disabled until the Supabase configuration and migrations are applied. Restart `npm run dev` after changing `.env.local`.

## 3. Configure Auth

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000` (later, the Vercel URL).
- Redirect URLs: add `http://localhost:3000/auth/confirm` and `https://<your-vercel-domain>/auth/confirm`.

**Authentication → Sign In / Providers → Email**: keep Email enabled.
- For a fast hackathon loop you may turn **Confirm email** off: sign-up then signs in immediately. With it on, users click the emailed link, which lands on `/auth/confirm`.
- Supabase's built-in email sender is rate-limited (a few emails per hour). Use confirm-off or custom SMTP for the demo.

## 4. Create two test accounts and verify

1. `npm run dev`, open `/signup`, create **Student A** and **Student B** (different emails, display names).
2. Add their credentials to `.env.local` (never commit):

   ```
   MARTLET_TEST_A_EMAIL=...
   MARTLET_TEST_A_PASSWORD=...
   MARTLET_TEST_B_EMAIL=...
   MARTLET_TEST_B_PASSWORD=...
   ```

3. Run the live RLS/auth check:

   ```sh
   node --env-file=.env.local supabase/verify.mjs
   node --env-file=.env.local supabase/verify-landmarks.mjs   # landmark unlocks + photo Storage rules
   ```

   It signs in as both users plus an anonymous client and tries impersonation, cross-user cancel, editing,
   re-opening, past/unapproved inserts, duplicate and invalid pecks. It leaves a few cancelled
   `[verify] …` meetups behind (there is no delete policy).

## Service API (`lib/meetups.ts`, server-only)

Signatures are frozen (see `docs/CONTRACTS.md`). Call them from Server Components, Server Actions or Route Handlers.

- `listMeetups()`: open meetups starting in the future, soonest first (max 100). `[]` when signed out.
- `getMeetup(id)`: any meetup incl. cancelled/past; `null` if missing, not a UUID, or signed out.
- `createMeetup(input)`: validates with `validateCreateMeetupInput` (`lib/meetup-validation.ts`, safe to import in client forms), re-checks the location against `CAMPUS_LOCATIONS` and stores the canonical coordinates, uses the session user as `host_id`.
- `cancelMeetup(id)`: host-only, idempotent.

Errors to catch in Server Actions: `AuthRequiredError`, `MeetupValidationError` (has `fieldErrors`), `MeetupNotFoundError` (also when the caller is not the host), `MockModeError`.

Auth helpers: `getCurrentUser()` / `requireUser()` in `lib/supabase/auth.ts`; `<AuthStatus />` and `<SignOutButton />` in `components/auth/`.

## Verify meetup polls

Run `node --test tests/poll-validation.test.mjs` with Node.js 22 or newer. On a disposable local database with migrations 001–007 applied, run `tests/poll-database.test.sql` with SQL Editor or `psql -v ON_ERROR_STOP=1 -f tests/poll-database.test.sql`. The test creates synthetic fixtures inside a transaction and rolls them back.

For hosted verification, use two approved test accounts. Have the host create a location poll on an upcoming meetup. Have the second account vote and change its choice without Pecking. Check the totals, then have the host close the poll and confirm the choices are read-only.

## Known limitations

- RLS reads are open to **all signed-in users**, and sign-up accepts any email domain. Restricting to McGill emails is not implemented.
- Display names are not moderated; profile editing UI is not built (the DB allows users to update their own `display_name` only).
- Counts are aggregated per request (`meetup_pecks(count)`); fine for the MVP, add counters/a view if it gets slow.
- No delete for meetups (soft cancel only), so test data accumulates in the dev project.
- Rate limiting and abuse controls rely on Supabase defaults.
