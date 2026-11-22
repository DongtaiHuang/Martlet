import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
export const hasGoogleMaps = Boolean(browserKey);
export const googleMapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() || "DEMO_MAP_ID";

let configured = false;
export function loadGoogleLibrary(name: "maps"): Promise<google.maps.MapsLibrary>;
export function loadGoogleLibrary(name: "marker"): Promise<google.maps.MarkerLibrary>;
export function loadGoogleLibrary(name: "places"): Promise<google.maps.PlacesLibrary>;
export function loadGoogleLibrary(name: "maps" | "marker" | "places") {
  if (!browserKey) return Promise.reject(new Error("Google Maps is not configured."));
  if (!configured) {
    setOptions({ key: browserKey, v: "weekly" });
    configured = true;
  }
  return importLibrary(name);
}
