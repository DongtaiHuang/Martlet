// McGill's campus buildings highlighted in McGill red on every 3D campus map (ADR 0048):
//  - "outline" (Explore, Landmarks, meetup maps): a crisp red line around each footprint, while
//    the buildings keep the basemap's colour and height. Clean on a reference map.
//  - "solid" (Martlet Skies and Drift): the buildings themselves in McGill red. On the pixelated
//    game maps a thin outline is lost; solid red reads from the air and the road.
// Footprints were taken once from OpenStreetMap (every building in the mapped McGill campus area,
// © OpenStreetMap contributors, ODbL), set 2% outside the walls and 1 m above the basemap's
// estimate so neither style flickers against the basemap's own buildings.
import type { Map as MapLibre } from "maplibre-gl";

const SOURCE = "mcgill-buildings";
export const MCGILL_RED = "#a6192e";
const OUTLINE_RED = "#d6213a";

export type McgillStyle = "outline" | "solid";

/** Adds the highlight now and after every style swap (light/dark mode). */
export function showMcgillBuildings(map: MapLibre, style: McgillStyle = "outline") {
  const add = () => {
    if (map.getSource(SOURCE)) return;
    map.addSource(SOURCE, { type: "geojson", data: "/data/mcgill-buildings.json", attribution: "© OpenStreetMap contributors" });
    const firstSymbol = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
    if (style === "solid") {
      map.addLayer({
        id: "mcgill-buildings-3d", type: "fill-extrusion", source: SOURCE,
        paint: { "fill-extrusion-color": MCGILL_RED, "fill-extrusion-height": ["get", "height"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.95 },
      }, firstSymbol);
    } else {
      map.addLayer({
        id: "mcgill-buildings-outline", type: "line", source: SOURCE,
        layout: { "line-join": "round" },
        paint: { "line-color": OUTLINE_RED, "line-width": ["interpolate", ["linear"], ["zoom"], 14, 1, 17, 2.5, 19, 4] },
      }, firstSymbol);
    }
  };
  if (map.isStyleLoaded()) add();
  map.on("style.load", add);
}
