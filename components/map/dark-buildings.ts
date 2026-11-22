import type { Map } from "maplibre-gl";
import { DEFAULT_DARK_STYLE_URL } from "./map-style";

/**
 * OpenFreeMap's dark style paints buildings rgb(10,10,10) on an rgb(12,12,12) background, so
 * they vanish, and it has no 3D buildings (unlike the light "liberty" style). After the dark
 * style loads, give buildings a visible warm-grey fill and add a matching 3D extrusion layer.
 * Only touches our default dark style; a custom NEXT_PUBLIC_MAP_STYLE_URL_DARK is left as is.
 */
export function enhanceDarkBuildings(map: Map, styleUrl: string) {
  if (styleUrl !== DEFAULT_DARK_STYLE_URL || !map.getLayer("building")) return;
  map.setPaintProperty("building", "fill-color", "#2b2724");
  map.setPaintProperty("building", "fill-outline-color", "#46403b");
  if (map.getLayer("building-3d")) return;
  const firstLabel = map.getStyle().layers?.find((l) => l.type === "symbol")?.id;
  map.addLayer({
    id: "building-3d",
    type: "fill-extrusion",
    source: "openmaptiles",
    "source-layer": "building",
    minzoom: 14,
    paint: {
      "fill-extrusion-color": "#3a3531",
      "fill-extrusion-height": ["get", "render_height"],
      "fill-extrusion-base": ["get", "render_min_height"],
      "fill-extrusion-opacity": 0.85,
    },
  }, firstLabel);
}
