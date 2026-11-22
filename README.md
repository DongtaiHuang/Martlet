# McGill Martlet

McGill Martlet is a campus social discovery app for spontaneous meetups. Students will be able to post meetups at approved campus landmarks, find events in a feed or on a map, Peck to join, and Flap to like.

The stack is Next.js App Router, React, TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Realtime), and MapLibre GL JS. Vercel is the deployment target.

## Local setup

Use Node.js 22.13+ and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The mock feed and development map work without a Supabase project. The demo map needs network access to load its style and tiles.

For local overrides, copy `.env.example` to `.env.local` and restart the development server after changing it. `.env.local` is Git-ignored.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Set with the publishable key to enable session handling. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. Keep service-role secrets out of public variables. |
| `NEXT_PUBLIC_MAP_STYLE_URL` | MapLibre style JSON URL. Development falls back to MapLibre demo tiles. Set a suitable licensed provider before building for Vercel. |

Run checks with `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

### Testing on your phone

Phones need HTTPS for the camera (`/avatar`), and Next.js blocks other devices by default. Find your computer's LAN IP (e.g. `ipconfig` → Wi-Fi IPv4) and run:

```sh
DEV_ALLOWED_ORIGINS=<your-ip> npm run dev -- -H 0.0.0.0 --experimental-https
```

Then open `https://<your-ip>:3000` on a phone on the same Wi-Fi and accept the self-signed certificate warning. Campus Wi-Fi often blocks device-to-device traffic; use a phone hotspot if the page doesn't load. If a map fails to start, `/explore` now shows the reason on screen.

## Routes

| Route | Current behavior |
| --- | --- |
| `/` | Redirects to `/meetups`. |
| `/meetups` | Shows sample meetup cards with links to their detail pages. |
| `/meetups/new` | Meetup creation placeholder. |
| `/meetups/[id]` | Meetup detail placeholder. Try `/meetups/demo-coffee`. |
| `/explore` | Campus map with sample meetup markers. A production build without a map style shows a fallback message. |
| `/profile` | Student profile placeholder. |
| `/login`, `/signup` | Email/password auth. With Supabase configured, all other pages redirect here when signed out. |

## Implementation status

Without Supabase credentials the app runs in **mock mode** (sample feed/map, no auth, writes disabled). With credentials it runs in **live mode**: email auth, protected pages, and real `listMeetups`/`getMeetup`/`createMeetup`/`cancelMeetup` backed by Supabase with RLS. Mock and live data are never mixed. Follow [Supabase setup](docs/SUPABASE_SETUP.md) to create the project, apply both migrations, and verify with two test accounts. Peck/Flap services, profile editing, and Realtime are team follow-up work.

## Team ownership and Git workflow

After the foundation PR is merged, each developer starts from the updated `main` and creates their assigned branch.

| Developer | Branch | Ownership |
| --- | --- | --- |
| 1 | `feature/social-feed` | Feed, navigation, filters, and profile UI |
| 2 | `feature/meetup-creation` | Meetup creation, details, and cancellation UI |
| 3 | `feature/supabase-auth` | Supabase schema, authentication, RLS, and meetup services |
| 4 | `feature/map-interactions` | Campus map, Peck and Flap, and Vercel deployment |

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/social-feed # substitute your assigned branch
npm ci
npm run dev
```

Push your feature branch and open a small PR targeting `main`. Coordinate changes to shared files, bring in updates from `main` regularly, and avoid force-pushing shared branches. See the [team plan](docs/TEAM_PLAN.md) and [shared contracts](docs/CONTRACTS.md) for handoffs and acceptance criteria.

The authentication foundation follows the [official Next.js Supabase starter](https://github.com/vercel/next.js/tree/canary/examples/with-supabase) and [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs).
