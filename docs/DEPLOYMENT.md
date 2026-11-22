# Production deployment on Vercel

## Inspect or import the project

1. In the team’s Vercel dashboard, look for a project already linked to `DongtaiHuang/Martlet`. Review its Domains, Git connection, environment scopes, deployment protection, and last healthy production deployment before making changes.
2. If there is no project, use **Add New → Project**, authorize the Vercel GitHub App for Martlet, and import the repository. Choose **Next.js**, the repository root, Node.js **22.x**, and default output settings. Use `npm run build` so the build generates the map and tracking assets. [Vercel project settings](https://vercel.com/docs/project-configuration/project-settings)
3. Set the **Production Branch** to `main` and expose Vercel’s system environment variables so the build can enforce `VERCEL_ENV`. Other branches use Preview. The stable production domain must let signed-out visitors reach Martlet’s login and signup pages. [Vercel Git deployments](https://vercel.com/docs/git)

## Environment variables

In **Project Settings → Environment Variables**, set the required values in **Production** using the confirmed production Supabase project. Use an authorized test project for Preview where available.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL. Required in Production. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. Required in Production. Keep service-role and secret keys out of the app. |
| `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAP_STYLE_URL_DARK` | Optional MapLibre style overrides. OpenFreeMap defaults to Liberty and Dark, with attribution in the map control. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAP_ID` | Optional Google browser integration. Use a domain-restricted browser key and an owned Map ID. |

Environment changes need a new deployment because Next.js embeds public settings at build time. Vercel production fails if the Supabase settings are missing or either configured map style uses MapLibre demo tiles.

Google Maps needs an authorized billing project, Maps JavaScript API, and Places API (New) for the optional lookup. Restrict the browser key to the necessary APIs and approved referrers. Set quotas and budget alerts. Keep the reserved `GOOGLE_MAPS_SERVER_API_KEY` unset. The app currently has no server-side Places verification. [Google Maps key restrictions](https://developers.google.com/maps/api-security-best-practices)

## Supabase readiness

Use the database owner’s **SQL Editor** to compare installed objects with the [Supabase migration guide](SUPABASE_SETUP.md). Identify migrations by full filename because several prefixes are shared. Confirm profiles, courses, meetup and reaction tables, campus and venue catalogs, landmarks and unlocks, achievements, notifications, trends, and the private `landmark-photos` bucket with their expected grants and policies.

Run these read-only queries for the recent meetup changes:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'meetups'
  and column_name in ('location_type', 'latitude', 'longitude', 'categories', 'course_code');

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = to_regclass('public.meetups')
  and conname in ('meetups_location_shape_check', 'meetups_categories_check', 'meetups_course_only_for_study');

select to_regprocedure('public.update_my_meetup(uuid,jsonb)') as edit_rpc;
select id, public from storage.buckets where id = 'landmark-photos';
```

If an object is missing, get team approval and apply only its missing migrations and prerequisites. In particular, `012_custom_meetup_locations.sql` requires the approved venue and course migrations, `013_meetup_editing.sql` requires 011 and 012, and `014_meetup_categories.sql` requires 013. Confirm that the edit RPC uses the category array after 014.

In Supabase **Authentication → URL Configuration**, set **Site URL** to the stable production HTTPS origin. Add that origin’s exact `/auth/confirm` URL to **Redirect URLs** and keep `http://localhost:3000/auth/confirm` for local development. Add a Preview callback only for an authorized test origin. The confirmation route accepts a PKCE code or a token hash from a custom email template. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

Keep the existing email confirmation policy. If confirmation is enabled, configure production SMTP and verify delivery to a fresh test account before launch. Treat unsuccessful delivery as a release blocker. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)

## Build, deploy, and verify

Run on Node.js 22.13 or later in the 22.x line:

```sh
npm ci
npx tsc --noEmit
npm run lint
npm run check:contrast
npm run build
```

1. Check the release PR’s Preview and CI. After review and merge, watch Vercel’s Deployments tab for the Git-triggered Production build of `main` and verify its source commit. For an environment-only change, redeploy the intended `main` build from Vercel.
2. Open the stable HTTPS URL from a signed-out browser outside the developer machine. Confirm signup and login load, protected routes send visitors to login, and the screens have no demo banner.
3. Use two approved accounts on desktop and mobile. Verify signup, confirmation, login, refresh, logout, and return to the requested protected page. Create campus, custom-location, and Coffee + Study meetups with a course. Verify host edit and cancellation, non-host rejection, Peck, Flap, leave, feed filters, and profile history. Check that anonymous and non-owner users lack access to private records and protected writes.
4. In Explore, landmarks, and the location previews, check tile loading, attribution, zoom, category filtering, and that text-only places have no map pin. Verify landmark unlocks, upload, gallery, zoom, replacement, and private Storage permissions.
5. Check trends, achievements, notifications, themes, footer, flying Martlet, Martlet Flight, and avatar tracking. Review the browser console, network panel, and Vercel runtime logs. Record the verified URL in the README after these checks.

## Troubleshooting and rollback

- Check the Vercel build log for Node, dependency install, Google Fonts, and MediaPipe downloads. The generated `/maplibre-gl-worker.mjs` and MediaPipe `.wasm` and `.task` URLs should return HTTP 200 with their assets, including while signed out. A login page in place of an asset indicates a routing or deployment mismatch. If the face or pose model fails to download, its tracking mode is unavailable even when the build succeeds.
- A demo banner means the build lacks one or both public Supabase settings. Check the environment scope and rebuild. If login works but meetup loads fail, inspect the schema and policies. If confirmation fails, check the Site URL, exact callback, and SMTP delivery.
- For map errors, inspect tile requests and attribution. For Google authorization errors, verify the browser key’s referrers and API restrictions, Map ID, quotas, and deployed origin.
- For a faulty production release, use **Instant Rollback** to restore the last healthy deployment and verify the stable domain. Validate the fix in Preview before restoring automatic production deployment from `main`. Have the database owner plan any separate schema recovery while preserving user data. [Vercel rollback](https://vercel.com/docs/instant-rollback)
