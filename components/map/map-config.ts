import { GeolocateControl, Map, NavigationControl, getVersion, setWorkerUrl } from "maplibre-gl";
import type { MeetupCategory } from "@/types/meetup";
import { initialMapStyle, trackMapStyle } from "./map-mode";
import { showMcgillBuildings } from "./mcgill-buildings";

// Shared by CampusMap (Explore), LandmarkMap (Landmarks) and MeetupLocationMap (meetup detail).

// Served from public/ by scripts/copy-maplibre-worker.mjs; the default relative URL 404s under Next.js.
setWorkerUrl(`/maplibre-gl-worker.mjs?v=${getVersion()}`);

export const MARKER_COLORS: Record<MeetupCategory, string> = {
  coffee: "#b45309", study: "#4338ca", food: "#c2410c",
  sports: "#047857", gaming: "#6d28d9", skills: "#0e7490", other: "#57534e",
};

export const CAMPUS_CENTER: [number, number] = [-73.577, 45.5045];
export const CAMPUS_ZOOM = 16;

/** Frame for the full-size campus maps (Explore and Landmarks), so they look the same. */
export const CAMPUS_MAP_FRAME = "h-[65vh] min-h-96 w-full overflow-hidden rounded-2xl border border-line";

/** The full-size campus map: same style, starting view and controls on Explore and Landmarks. */
export function createCampusMap(container: HTMLElement): Map {
  const style = initialMapStyle(); // light or dark basemap (ADR 0014)
  const map = new Map({ container, style, center: CAMPUS_CENTER, zoom: CAMPUS_ZOOM });
  trackMapStyle(map, style);
  showMcgillBuildings(map); // McGill's buildings outlined in red (ADR 0048)
  map.addControl(new NavigationControl(), "top-right");
  // ADR 0008: opt-in, one-shot "show my location". The position stays in the
  // browser (MapLibre draws a dot); it is never sent to our server or stored.
  map.addControl(new GeolocateControl({
    trackUserLocation: false,
    positionOptions: { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    fitBoundsOptions: { maxZoom: 16 },
  }), "top-right");
  return map;
}
