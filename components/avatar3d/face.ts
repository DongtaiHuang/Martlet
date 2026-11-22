// Expression state shared between the tracker and the 3D martlet (prototype).
// Only these numbers ever leave the tracker: no images are kept.

export interface Face {
  blinkL: number; blinkR: number; jaw: number; smile: number; browUp: number; browDown: number;
  yaw: number; pitch: number; roll: number;
  /** Arm raise per screen side, 0 = arm down, 1 = arm overhead (from pose tracking). */
  wingL: number; wingR: number;
}
export const NEUTRAL: Face = { blinkL: 0, blinkR: 0, jaw: 0, smile: 0, browUp: 0, browDown: 0, yaw: 0, pitch: 0, roll: 0, wingL: 0, wingR: 0 };
export const FACE_KEYS = Object.keys(NEUTRAL) as (keyof Face)[];

/** A recorded expression clip: ~15 samples/second of Face values. A few KB of numbers. */
export interface Clip { fps: number; frames: number[][] }

export const toRow = (f: Face) => FACE_KEYS.map((k) => Math.round(f[k] * 1000) / 1000);
export const fromRow = (row: number[]): Face => Object.fromEntries(FACE_KEYS.map((k, i) => [k, row[i] ?? 0])) as unknown as Face;
