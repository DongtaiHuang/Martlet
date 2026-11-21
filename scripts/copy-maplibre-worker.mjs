// MapLibre v6 loads its tile worker as a separate module next to the bundle,
// which Next.js doesn't serve. Copy it to public/ so the map can load it from
// /maplibre-gl-worker.mjs (see components/map/CampusMap.tsx). Runs before dev/build.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
