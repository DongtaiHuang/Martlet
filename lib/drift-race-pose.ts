// Car positions in a live Drift race (ADR 0053). Pure, so node --test can import it.

/** A car in the race: seat, position, heading, score so far, paint and the run's clock. */
export type RivalPose = { seat: number; x: number; z: number; h: number; s: number; p: number; t: number };

const finite = (v: unknown, limit: number) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit;

/** Checks a pose from another browser before it's used. */
export function readPose(payload: unknown): RivalPose | null {
  const p = payload as Partial<RivalPose> | null;
  if (!p || !Number.isInteger(p.seat) || p.seat! < 1 || p.seat! > 4) return null;
  if (!finite(p.x, 5000) || !finite(p.z, 5000) || !finite(p.h, 100) || !finite(p.s, 300000) || !finite(p.t, 1000)) return null;
  if (!Number.isInteger(p.p) || p.p! < 0 || p.p! > 15) return null;
  return { seat: p.seat!, x: p.x!, z: p.z!, h: p.h!, s: Math.round(p.s!), p: p.p!, t: p.t! };
}
