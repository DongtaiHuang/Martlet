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

In **SQL Editor**, paste and run each file once, in this order. It's filename order, which is also the order CI uses (`npm run test:db`, ADR 0028), so a list that CI keeps green applies cleanly to a fresh project. Several files share a numeric prefix (two each of `007`, `008`, `010` and `012`), so always identify a migration by its **full filename**.

| # | File | What it adds | Notes |
|---|---|---|---|
| 1 | `001_mvp.sql` | Schema, profile trigger, base RLS | Fresh project only; not re-runnable |
| 2 | `002_security_hardening.sql` | RLS/privilege hardening, approved campus locations | Apply before `008_off_campus_meetups`; never rerun after it (see below) |
| 3 | `003_more_campus_locations.sql` | More downtown campus meetup locations | Safe to re-run |
| 4 | `004_backfill_profiles.sql` | Profiles for accounts created before `001` | Safe to re-run |
| 5 | `005_table_grants.sql` | Explicit table privileges (newer Supabase projects don't auto-grant, causing `permission denied`) | Safe to re-run |
| 6 | `006_landmarks.sql` | Landmarks, photo unlocks, private `landmark-photos` bucket (ADR 0009) | Safe to re-run. Coordinates are approximate; keep `lib/mock-landmarks.ts` in sync |
| 7 | `007_courses.sql` | `courses` catalogue and each student's private `user_courses` (issue #25) | Safe to re-run |
| 8 | `007_meetup_polls.sql` | Advisory polls (ADR 0011) | **Historical.** The poll UI is retired (ADR 0022). Fresh projects may skip it; existing projects keep their poll data |
| 9 | `008_course_catalog.sql` | About 10,000 McGill courses from `scripts/import-mcgill-courses.mjs` | Safe to re-run. About 480 KB; if the SQL Editor struggles, use `psql "<connection string>" -f supabase/migrations/008_course_catalog.sql`. Rerun the import script for a new academic year |
| 10 | `008_off_campus_meetups.sql` | Approved public venues (ADR 0015) | After `002`. Replaces the campus-only foreign key with separate campus and venue keys; existing meetups keep their locations |
| 11 | `009_meetup_course.sql` | Optional course code on study meetups | After the course catalogue. Safe to re-run |
| 12 | `010_achievements.sql` | Account-backed achievements (ADR 0019) | Safe to re-run |
| 13 | `010_trends.sql` | The feed's Trends panel (ADR 0017) | Run once |
| 14 | `011_notifications.sql` | Persistent notifications (ADR 0021) | After the meetup course and Trends migrations. Safe to re-run |
| 15 | `012_custom_meetup_locations.sql` | Text-only custom meeting spots (ADR 0022) | Apply **once**. Skip it if the identical SQL was applied under its earlier name `010_custom_meetup_locations.sql` (see below) |
| 16 | `012_expo_67_landmark.sql` | Expo 67 Biosphère landmark and the photo needed for the 67 badge | After landmarks and achievements. Safe to re-run |
| 17 | `013_meetup_editing.sql` | Hosts edit upcoming meetups via `update_my_meetup`; `meetup_updated` notification (ADR 0023) | After `011` and `012`. Safe to re-run |
| 18 | `014_meetup_categories.sql` | Ordered multi-category meetups | Once, after `013` and before deploying the multi-category app. Backfills existing meetups and keeps `category` as the first one |
| 19 | `015_guest_browsing.sql` | Read-only guest view of meetups and landmarks through one summary function (ADR 0025) | Landmark photos stay members-only |
| 20 | `016_flight_leaderboard.sql` | Martlet Flight leaderboard with server-timed runs (ADR 0026) | |
| 21 | `017_community_board.sql` | Campus Board (memes, tips, Q&A, skill listings), reports and moderation (ADR 0027) | Set moderators by hand with `profiles.is_moderator` |

**Production:** take a backup first, then have the database owner apply only the migrations that are missing. Check which ones are installed with the read-only queries in [DEPLOYMENT.md](DEPLOYMENT.md#supabase-readiness).

`002` adds the original campus-only foreign key. On a project upgrading from 001, resolve any existing locations that fail that constraint before running 002. After applying 008, do not rerun 002 because it reinstates the campus-only foreign key.

**When adding a campus location**, update `lib/locations.ts` and create a new idempotent migration to insert the matching canonical name and coordinates in `public.campus_locations`; then run it in Supabase. Do not rewrite migrations that teammates may have already applied.

**Sign-in not available?** In local mock mode (without both `NEXT_PUBLIC_SUPABASE_*` variables), the nav still exposes `/login` and `/signup` for discovery, but account creation and meetup publishing are disabled until the Supabase configuration and migrations are applied. Restart `npm run dev` after changing `.env.local`.

## 3. Configure Auth

**Authentication → URL Configuration**
- Site URL: `http://localhost:3000` (later, the Vercel URL).
- Redirect URLs: add `http://localhost:3000/auth/confirm` and `https://<your-vercel-domain>/auth/confirm`.

**Authentication → Sign In / Providers → Email**: keep Email enabled.
- For quick local testing you may turn **Confirm email** off (keep it on in production): sign-up then signs in immediately. With it on, users click the emailed link, which lands on `/auth/confirm`.
- Supabase's built-in email sender is rate-limited (a few emails per hour). Use custom SMTP in production (see [DEPLOYMENT.md](DEPLOYMENT.md)).

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
- `createMeetup(input)`: validates with `validateCreateMeetupInput` (`lib/meetup-validation.ts`, safe to import in client forms), validates approved campus coordinates or custom text-only locations with null coordinates, uses the session user as `host_id`.
- `cancelMeetup(id)`: host-only, idempotent.

Errors to catch in Server Actions: `AuthRequiredError`, `MeetupValidationError` (has `fieldErrors`), `MeetupNotFoundError` (also when the caller is not the host), `MockModeError`.

Auth helpers: `getCurrentUser()` / `requireUser()` in `lib/supabase/auth.ts`; `<AuthStatus />` and `<SignOutButton />` in `components/auth/`.

## Deploy custom meetup locations

The `Other` option accepts 3–160 characters of trimmed meeting instructions, without Google Places selection. A text-only custom meetup stores `location_type = 'custom'`, a null latitude/longitude pair, and no public venue ID. Approved campus locations retain canonical coordinates; catalog venues remain supported for existing rows. No map pin should be invented for unmapped meetups.

**Database-owner checklist (read-only first):**

```sql
select to_regclass('public.public_meetup_venues') as venue_catalog;
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'meetups'
  and column_name in ('public_venue_id','course_code','location_type','latitude','longitude');
select conname from pg_constraint where conrelid = 'public.meetups'::regclass;
```

Before running `012_custom_meetup_locations.sql`, check the actual schema and which full migration filenames have already been applied. The team has multiple `007`, `008`, and `010` files; do not assume a numeric prefix uniquely identifies a migration. The custom-location SQL was initially named `010_custom_meetup_locations.sql` on an unmerged branch and may already have been applied manually. Do **not** re-run it on a project with `location_type` and `meetups_location_shape_check`.

Apply missing prerequisites through the database owner, review before writing to the shared schema, and run `012_custom_meetup_locations.sql` at most once when absent. Then verify `latitude`/`longitude` are nullable and both catalog and custom inserts obey RLS. Test custom and campus meetup creation, detail, feed, and Explore.

The original `007_meetup_polls.sql` is historical. The application no longer calls its RPCs. Preserve existing poll tables, functions, and votes; fresh projects need not create them.

## Known limitations

- RLS reads are open to **all signed-in users**, and sign-up accepts any email domain. Restricting to McGill emails is not implemented.
- Display names are not moderated; profile editing UI is not built (the DB allows users to update their own `display_name` only).
- Counts are aggregated per request (`meetup_pecks(count)`); fine for the MVP, add counters/a view if it gets slow.
- No delete for meetups (soft cancel only), so test data accumulates in the dev project.
- Rate limiting and abuse controls rely on Supabase defaults.

## Google Places rollout

Google search is an optional preview only; it does not write provider content or select the custom-location text. Campus publishing still uses canonical coordinates, while custom publishing uses text-only meeting instructions. Before enabling Google place publishing, verify the hosted migration history and catalog with the database owner. The course and poll branches both have 007 files, and the course catalog and off-campus branches both have 008 files. Identify each by full filename and applied database objects. Reconcile filename collisions before running the files through a version-based migration tool. Preserve applied migration files. A future Places write migration must use a new identity after the course and location migrations.
