// Kept free of maplibre-gl so Server Components can import it.

/** Landmark pins: gold while still to discover, green once completed (unlocked). */
export const LANDMARK_COLORS = { unlocked: "#059669", locked: "#ca8a04" } as const; // emerald-600 / yellow-600

/** Zoom that roughly fits a landmark's check-in radius in a small map. */
export function landmarkZoom(radiusM: number): number {
  if (radiusM >= 600) return 14;
  if (radiusM >= 200) return 15.5;
  return 16.5;
}
