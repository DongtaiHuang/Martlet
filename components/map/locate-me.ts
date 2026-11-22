// Browser-only "where am I?" for the maps (ADR 0008). The position is used to draw a dot,
// frame the map and show a distance on this screen. It is never sent to our server or
// Supabase, logged, stored, or put in a URL.

export interface Position {
  latitude: number;
  longitude: number;
}

export type LocateError = "unsupported" | "denied" | "unavailable";

/** One-shot, low-accuracy position, requested only when the user asks (ADR 0008). */
export function requestPositionOnce(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator) || !window.isSecureContext) {
      reject("unsupported" satisfies LocateError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject((error.code === error.PERMISSION_DENIED ? "denied" : "unavailable") satisfies LocateError),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  });
}

/** Straight-line distance in metres (haversine). */
export function distanceMetres(a: Position, b: Position): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** "about 350 m", "about 1.2 km", "about 48 km". Low-accuracy positions don't deserve more precision. */
export function formatDistance(metres: number): string {
  // Thresholds sit where rounding would roll over ("1000 m" → "1.0 km", "10.0 km" → "10 km").
  if (metres < 995) return `about ${Math.max(10, Math.round(metres / 10) * 10)} m`;
  if (metres < 9_950) return `about ${(metres / 1000).toFixed(1)} km`;
  return `about ${Math.round(metres / 1000).toLocaleString("en-CA")} km`;
}

/** Map padding so the two pins don't sit on the edge or under the zoom buttons. */
export const FIT_PADDING = { top: 56, bottom: 40, left: 40, right: 64 };

/** The blue "you are here" dot, shared by the MapLibre and Google maps. */
export function userDotElement(): HTMLDivElement {
  const dot = document.createElement("div");
  dot.setAttribute("role", "img");
  dot.setAttribute("aria-label", "Your approximate location");
  dot.style.cssText = "width:18px;height:18px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25),0 1px 3px rgba(0,0,0,.4)";
  return dot;
}
