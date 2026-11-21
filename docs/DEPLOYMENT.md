# Deployment (Vercel) and map style

## Map style (`NEXT_PUBLIC_MAP_STYLE_URL`)

`components/map/map-style.ts` picks the MapLibre style:

| Environment | Unset | Demo tiles URL | Real style URL |
|---|---|---|---|
| `npm run dev` | MapLibre demo tiles | used | used |
| production build | "map unavailable" message | rejected | used |
| Vercel production | **build fails** (`next.config.ts`) | **build fails** | used |

Pick a provider whose terms allow your deployed domain, for example:
- **OpenFreeMap:** `https://tiles.openfreemap.org/styles/liberty`. No key needed; check the attribution requirements.
- **MapTiler / Stadia Maps:** sign up, restrict the key to your Vercel domain(s), and use their style JSON URL.

The style URL ends up in the browser, so only use **domain-restricted** public keys. Never put a secret key here.

## Vercel setup

1. Import `DongtaiHuang/Martlet` in Vercel. The framework (Next.js) is auto-detected and no `vercel.json` is needed.
2. Project → Settings → Environment Variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only, **never** the service-role key)
   - `NEXT_PUBLIC_MAP_STYLE_URL` (required for Production)
3. Node.js version: 22.x (Settings → General).
4. Supabase → Authentication → URL Configuration: add the Vercel URL to **Site URL** and **Redirect URLs**.
5. Before you share the URL, confirm RLS is applied (`supabase/migrations/001_mvp.sql`) and run the two-account test from `docs/CONTRACTS.md`.

Preview deployments may leave the map style unset. They then show the "map unavailable" message instead of failing.
