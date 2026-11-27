import type { Map as MapLibre } from "maplibre-gl";

/**
 * Shows the map credit as its ⓘ button, not the open banner MapLibre starts with on small screens
 * (it covered the game's start card). Done at once, and again when the map loads or resizes;
 * tapping ⓘ still opens it.
 */
export function collapseCredit(map: MapLibre) {
  const collapse = () => map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  collapse();
  map.once("load", collapse);
  map.on("resize", collapse);
}
