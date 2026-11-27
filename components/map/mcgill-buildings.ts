// McGill's campus buildings in McGill red on the game maps (Martlet Drift and Skies, ADR 0048).
// The footprints were taken once from OpenStreetMap (every building in the mapped McGill campus
// area, © OpenStreetMap contributors, ODbL), nudged 1.5% outward and 1 m taller than the basemap's
// own extrusion so the red walls sit just outside the grey ones instead of flickering against them.
import type { Map as MapLibre } from "maplibre-gl";

const SOURCE = "mcgill-buildings";
const LAYER = "mcgill-buildings-3d";
export const MCGILL_RED = "#a6192e";

/** Adds the red McGill buildings now and after every style swap (light/dark mode). */
export function showMcgillBuildings(map: MapLibre) {
  const add = () => {
    if (map.getSource(SOURCE)) return;
    map.addSource(SOURCE, { type: "geojson", data: "/data/mcgill-buildings.json", attribution: "© OpenStreetMap contributors" });
    // Under the labels (hidden in the games anyway), over the basemap's own buildings.
    const firstSymbol = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
    map.addLayer({
      id: LAYER, type: "fill-extrusion", source: SOURCE,
      paint: {
        "fill-extrusion-color": MCGILL_RED,
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.95,
        "fill-extrusion-vertical-gradient": true,
      },
    }, firstSymbol);
  };
  if (map.isStyleLoaded()) add();
  map.on("style.load", add);
}
