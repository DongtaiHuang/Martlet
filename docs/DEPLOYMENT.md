# Deployment (Vercel) and map style

## Map style (`NEXT_PUBLIC_MAP_STYLE_URL`)

`components/map/map-style.ts` picks the MapLibre style:

- **Unset:** [OpenFreeMap](https://openfreemap.org) `liberty` style (`https://tiles.openfreemap.org/styles/liberty`). It's free, needs no key, allows production use, and shows the required attribution automatically.
- **Set:** that URL is used, for example a MapTiler or Stadia Maps style with a key restricted to your Vercel domain(s).
- **MapLibre demo tiles** (`demotiles.maplibre.org`) are ignored at runtime and **fail Vercel production builds** (`next.config.ts`). They only contain country outlines and are development-only.

The style URL ends up in the browser, so only use **domain-restricted** public keys. Never put a secret key here.

## Dark mode map style (ADR 0014)

In dark mode the maps use OpenFreeMap's `dark` style (`https://tiles.openfreemap.org/styles/dark`). To use a different provider's dark style, set `NEXT_PUBLIC_MAP_STYLE_URL_DARK` (optional, same rules as `NEXT_PUBLIC_MAP_STYLE_URL`).

## Martlet avatar models (ADR 0010)

`npm run dev` and `npm run build` run `scripts/copy-mediapipe-wasm.mjs`. It copies MediaPipe's WebAssembly runtime and downloads the face model (about 3.8 MB) and the pose model (about 5.8 MB) into `public/mediapipe/` (git-ignored), so the build needs network access the first time. If the download fails, the build still passes and `/avatar` shows a tracking error. No environment variables are needed.

## Vercel setup

1. Import `DongtaiHuang/Martlet` in Vercel. The framework (Next.js) is auto-detected and no `vercel.json` is needed.
2. Project → Settings → Environment Variables (Production and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only, **never** the service-role key)
   - `NEXT_PUBLIC_MAP_STYLE_URL` (optional; defaults to OpenFreeMap)
3. Node.js version: 22.x (Settings → General).
4. Supabase → Authentication → URL Configuration: add the Vercel URL to **Site URL** and **Redirect URLs**.
5. Before you share the URL, confirm RLS is applied (`supabase/migrations/001_mvp.sql`) and run the two-account test from `docs/CONTRACTS.md`.

## Google Maps

Enable billing, Maps JavaScript API and Places API (New) in the Google Cloud project. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and NEXT_PUBLIC_GOOGLE_MAP_ID in .env for local development and in Vercel before rebuilding. Restrict the browser key to those APIs and approved localhost and Vercel HTTP referrers, including preview domains only when needed. Use an owned Map ID for production. Configure API quotas and budget alerts and monitor billable map loads and places requests. Budget alerts are notifications.

GOOGLE_MAPS_SERVER_API_KEY is reserved for server-side Place Details verification. Set it only when that path is deployed. Restrict it to Places API (New) and the supported server IP restriction for the deployment's egress. Keep it out of the browser bundle. Without a browser key, independently sourced maps continue to use MapLibre and Google search is unavailable.

See [Google Maps API security best practices](https://developers.google.com/maps/api-security-best-practices) and [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies).
