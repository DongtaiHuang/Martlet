// The real campus under Martlet Drift (ADR 0047): a pixelated, non-interactive MapLibre map whose
// camera copies the three.js chase camera every frame, so the coupe drives on the real streets.
import { LngLat, Map as MapLibre } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/components/map/map-config"; // sets MapLibre's worker URL
import { initialMapStyle, trackMapStyle } from "@/components/map/map-mode";
import { showMcgillBuildings } from "@/components/map/mcgill-buildings";
import { PIXEL_SIZE } from "@/components/pixel/pixel3d";
import { worldToLngLat } from "@/lib/drift-map";
import { ORIGIN } from "@/lib/drift-streets";
import { collapseCredit } from "@/components/map/map-credit";

/** Must match the three.js camera's vertical field of view. */
export const DRIFT_FOV = 60;

export function createDriftMap(container: HTMLElement): MapLibre {
  const style = initialMapStyle();
  const map = new MapLibre({
    container, style, center: [ORIGIN.lng, ORIGIN.lat], zoom: 17, pitch: 70, maxPitch: 85,
    pixelRatio: 1 / PIXEL_SIZE, interactive: false, fadeDuration: 0, attributionControl: { compact: true },
  });
  trackMapStyle(map, style);
  showMcgillBuildings(map, "solid"); // McGill's buildings in red along the loop
  map.setVerticalFieldOfView(DRIFT_FOV);
  // Labels turn to mush when pixelated; keep the credit as its ⓘ button.
  map.on("style.load", () => {
    for (const layer of map.getStyle().layers) if (layer.type === "symbol") map.setLayoutProperty(layer.id, "visibility", "none");
  });
  collapseCredit(map);
  return map;
}

/** Point the map's camera from the three.js camera position at the same target. */
export function syncDriftMap(map: MapLibre, camera: { x: number; y: number; z: number }, target: { x: number; y: number; z: number }) {
  const from = worldToLngLat(camera.x, camera.z);
  const to = worldToLngLat(target.x, target.z);
  try {
    map.jumpTo(map.calculateCameraOptionsFromTo(new LngLat(from.lng, from.lat), Math.max(1, camera.y), new LngLat(to.lng, to.lat), target.y));
  } catch {
    // The map may not be ready on the first frames; the next frame tries again.
  }
}
