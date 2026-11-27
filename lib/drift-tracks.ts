// Martlet Drift's tracks (ADR 0052): the street loop and the campus loop, each with its own
// leaderboard and ghosts (migration 036). Pure, so node --test can import it.
import { CAMPUS_LOOP, CAMPUS_SIGNS, CAMPUS_SIGN_OF_POINT } from "./drift-campus.ts";
import { STREET_LOOP, STREETS, STREET_OF_POINT } from "./drift-streets.ts";

export const TRACK_IDS = ["streets", "campus"] as const;
export type TrackId = (typeof TRACK_IDS)[number];

export const TRACKS: Record<TrackId, { name: string; blurb: string; loop: [number, number][]; signs: readonly string[]; signOfPoint: readonly number[] }> = {
  streets: {
    name: "Street loop", blurb: "Sherbrooke, University, Pine and McTavish: 1.8 km of long straights and big corners.",
    loop: STREET_LOOP, signs: STREETS.map((s) => s.sign), signOfPoint: STREET_OF_POINT,
  },
  campus: {
    name: "Campus", blurb: "In through the Roddick Gates, past the Arts Building and Leacock: 850 m of tight turns.",
    loop: CAMPUS_LOOP, signs: CAMPUS_SIGNS, signOfPoint: CAMPUS_SIGN_OF_POINT,
  },
};

export const isTrackId = (value: unknown): value is TrackId => TRACK_IDS.includes(value as TrackId);

/** The sign for a point index on a track built from `track`'s loop with `count` points. */
export function signAt(track: TrackId, index: number, count: number): string {
  const t = TRACKS[track];
  const control = Math.floor((index * t.loop.length) / count) % t.loop.length;
  return t.signs[t.signOfPoint[control]];
}
