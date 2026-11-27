// Martlet Drift ghost replays (ADR 0050). A run is recorded 10 times a second as
// [x*10, z*10, heading*1000, score/10] (smallints, matching migration 034), and replayed by
// interpolating between samples. Pure, so node --test can import it.

export const GHOST_HZ = 10;

export type Ghost = { name: string; score: number; paint: number; path: number[]; me: boolean };
export type GhostState = { x: number; z: number; heading: number; score: number };

/** One sample for the replay, rounded to what the database stores. */
export function encodeSample(x: number, z: number, heading: number, score: number): [number, number, number, number] {
  const h = Math.atan2(Math.sin(heading), Math.cos(heading)); // keep -π..π so it fits a smallint
  return [Math.round(x * 10), Math.round(z * 10), Math.round(h * 1000), Math.min(20700, Math.max(0, Math.floor(score / 10)))];
}

/** Where the ghost is `t` seconds into its run (holding its last sample after the end). */
export function ghostAt(path: readonly number[], t: number): GhostState | null {
  const n = Math.floor(path.length / 4);
  if (n === 0) return null;
  const f = Math.max(0, Math.min(n - 1, t * GHOST_HZ));
  const i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i;
  const at = (s: number, o: number) => path[s * 4 + o];
  const lerp = (o: number) => at(i, o) + (at(j, o) - at(i, o)) * k;
  // Headings wrap: interpolate the short way round.
  const h0 = at(i, 2) / 1000, h1 = at(j, 2) / 1000;
  const dh = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
  return { x: lerp(0) / 10, z: lerp(1) / 10, heading: h0 + dh * k, score: Math.round(lerp(3) * 10) };
}

/** Top ghosts plus your own, without duplicates, best first. */
export function ghostChoices(top: readonly Ghost[], mine: Ghost | null): Ghost[] {
  const list = [...top];
  if (mine && !list.some((g) => g.me)) list.push(mine);
  return list.sort((a, b) => b.score - a.score);
}
