// What Martlet Drift's HUD shows about where you are (ADR 0047): the street you're on and the
// McGill building you're passing. Pure, so node --test can import it.
import { STREET_LOOP, STREETS, STREET_OF_POINT } from "./drift-streets.ts";

/** The street for a point index on a track built from STREET_LOOP with `count` points. */
export function streetAt(index: number, count: number) {
  const control = Math.floor((index * STREET_LOOP.length) / count) % STREET_LOOP.length;
  return STREETS[STREET_OF_POINT[control]];
}

export type NamedOutline = { name: string; points: { x: number; z: number }[] };

/** The named building whose outline comes within `max` metres of (x, z), if any. */
export function passing(x: number, z: number, buildings: readonly NamedOutline[], max = 30): string | null {
  let best: { name: string; d: number } | null = null;
  for (const b of buildings) {
    const pts = b.points;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      const dx = c.x - a.x, dz = c.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
      if (d <= max && (!best || d < best.d)) best = { name: b.name, d };
    }
  }
  return best?.name ?? null;
}
