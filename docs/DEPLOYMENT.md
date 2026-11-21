# Deployment (Vercel) and map style

## Map style (`NEXT_PUBLIC_MAP_STYLE_URL`)

`components/map/map-style.ts` picks the MapLibre style:

- **Unset:** [OpenFreeMap](https://openfreemap.org) `liberty` style (`https://tiles.openfreemap.org/styles/liberty`). It's free, needs no key, allows production use, and shows the required attribution automatically.
- **Set:** that URL is used, for example a MapTiler or Stadia Maps style with a key restricted to your Vercel domain(s).
- **MapLibre demo tiles** (`demotiles.maplibre.org`) are ignored at runtime and **fail Vercel production builds** (`next.config.ts`). They only contain country outlines and are development-only.

The style URL ends up in the browser, so only use **domain-restricted** public keys. Never put a secret key here.

## Vercel setup

1. Import `DongtaiHuang/Martlet` in Vercel. The framework (Next.js) is auto-detected and no `vercel.json` is needed.
2. Project → Settings → Environment Variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only, **never** the service-role key)
   - `NEXT_PUBLIC_MAP_STYLE_URL` (optional; defaults to OpenFreeMap)
3. Node.js version: 22.x (Settings → General).
4. Supabase → Authentication → URL Configuration: add the Vercel URL to **Site URL** and **Redirect URLs**.
5. Before you share the URL, confirm RLS is applied (`supabase/migrations/001_mvp.sql`) and run the two-account test from `docs/CONTRACTS.md`.
