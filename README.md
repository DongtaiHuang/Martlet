# McGill Martlet

McGill Martlet is a campus social discovery app for spontaneous meetups. Students can create and edit multi-category meetups, discover campus landmarks, Peck to join, and Flap to like.

The stack is Next.js App Router, React, TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Realtime), and MapLibre GL JS. Vercel is the deployment target.

## Local setup

Use Node.js 22.x (22.13 or later) and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Without Supabase settings the app uses sample data and disables writes. The map uses OpenFreeMap by default and needs network access for its style and tiles.

For local overrides, copy `.env.example` to `.env.local` and restart the development server after changing it. `.env.local` is Git-ignored.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Set with the publishable key to enable session handling. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. Keep service-role secrets out of public variables. |
| `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_MAP_STYLE_URL_DARK` | Optional MapLibre style overrides. Both default to OpenFreeMap. |

Run checks with `npx tsc --noEmit`, `npm run lint`, `npm run check:contrast`, and `npm run build`.

## Routes

| Route | Current behavior |
| --- | --- |
| `/` | Redirects to `/meetups`. |
| `/meetups` | Upcoming meetups, category filters, community trends, and Martlet Flight. |
| `/meetups/new` | Create a campus or custom-location meetup with up to three categories. |
| `/meetups/[id]` | Meetup details, Pecks, and Flaps. Hosts can edit or cancel eligible meetups. |
| `/explore` | Meetup and landmark map, with a list for text-only meetup locations. |
| `/landmarks` | Campus discovery, photo galleries, and landmark unlocks. |
| `/profile` | Student profile, courses, and meetup history. |
| `/login`, `/signup` | Email/password auth. With Supabase configured, all other pages redirect here when signed out. |

## Production deployment

Use live Supabase settings for Vercel Production. Configure the project, confirm the hosted schema and auth callback, and verify the release with two approved accounts. See the [deployment and rollback guide](docs/DEPLOYMENT.md) and [Supabase setup](docs/SUPABASE_SETUP.md).

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
