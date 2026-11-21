// Kept free of maplibre-gl so Server Components can import it.

/** Landmark pins (ADR 0009): gold once unlocked, grey while locked. */
export const LANDMARK_COLORS = { unlocked: "#ca8a04", locked: "#78716c" } as const;

/** Zoom that roughly fits a landmark's check-in radius in a small map. */
export function landmarkZoom(radiusM: number): number {
  if (radiusM >= 600) return 14;
  if (radiusM >= 200) return 15.5;
  return 16.5;
}
