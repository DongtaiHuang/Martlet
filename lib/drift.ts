// Martlet Drift (issue #149, ADR 0037): arcade car physics, drift scoring and the track.
// Pure functions so they run the same in the game loop and in tests. Units: metres, seconds,
// radians. World axes: x to the right, z forward; heading 0 faces +z.

export interface Car { x: number; z: number; heading: number; vx: number; vz: number; yawRate: number; steer: number }
export interface Controls { throttle: number; brake: number; steer: number; handbrake: boolean } // steer: -1 left … 1 right

export const MAX_SPEED = 46;          // m/s, about 165 km/h
export const RUN_SECONDS = 90;
export const TRACK_WIDTH = 16;

const ENGINE = 13;      // m/s² at a standstill
const BRAKE = 22;
const REVERSE_MAX = 8;

export const forwardOf = (h: number) => ({ x: Math.sin(h), z: Math.cos(h) });
export const rightOf = (h: number) => ({ x: Math.cos(h), z: -Math.sin(h) });

/** Speed along the car and sideways (positive = sliding to the car's right). */
export function localVelocity(car: Car) {
  const f = forwardOf(car.heading), r = rightOf(car.heading);
  return { forward: car.vx * f.x + car.vz * f.z, side: car.vx * r.x + car.vz * r.z };
}

/** Angle between where the car points and where it's going, in degrees (0 = gripping). */
export function driftAngle(car: Car): number {
  const { forward, side } = localVelocity(car);
  if (Math.hypot(forward, side) < 1) return 0;
  return Math.abs(Math.atan2(side, Math.abs(forward))) * (180 / Math.PI) + (forward < 0 ? 90 : 0);
}

export const speedOf = (car: Car) => Math.hypot(car.vx, car.vz);

/**
 * One physics step. The velocity stays in the world frame while the body rotates, so turning
 * faster than the tyres can follow makes the car slide. The handbrake drops rear grip (start a
 * drift); throttle while sliding keeps grip low (hold it); steering sets the yaw (angle).
 */
export function step(car: Car, input: Controls, dt: number, onTrack: boolean): Car {
  let { forward: vf, side: vr } = localVelocity(car);
  const f = forwardOf(car.heading), r = rightOf(car.heading);
  const steer = car.steer + (input.steer - car.steer) * Math.min(1, dt * 8);

  // Engine, brakes, drag.
  if (input.throttle > 0) vf += input.throttle * ENGINE * Math.max(0, 1 - vf / MAX_SPEED) * dt;
  if (input.brake > 0) vf = vf > 0.5 ? Math.max(0, vf - input.brake * BRAKE * dt) : Math.max(-REVERSE_MAX, vf - input.brake * 8 * dt);
  vf -= vf * (0.05 + (onTrack ? 0 : 1.4) + (input.handbrake ? 0.35 : 0)) * dt;

  // Sideways grip.
  const slip = Math.atan2(Math.abs(vr), Math.abs(vf) + 0.5);
  const grip = input.handbrake ? 1.1 : input.throttle > 0.5 && slip > 0.22 ? 2.4 : onTrack ? 7 : 4;
  const before = Math.abs(vr);
  vr *= Math.exp(-grip * dt);
  // On the throttle in a slide, the rear tyres turn some of the scrubbed sideways speed into
  // forward drive, so a held drift keeps its pace (a power-slide) instead of just bleeding speed.
  if (input.throttle > 0 && onTrack && slip > 0.15 && Math.abs(vf) < MAX_SPEED * 0.75) vf += (before - Math.abs(vr)) * 0.4 * input.throttle * Math.sign(vf || 1);

  // Yaw follows the steering, more at speed; sliding cars rotate a little more freely.
  const speedFactor = Math.min(1, Math.abs(vf) / 8) * Math.sign(vf || 1);
  const target = steer * 2.1 * speedFactor * (input.handbrake ? 1.5 : slip > 0.22 ? 1.25 : 1);
  const yawRate = car.yawRate + (target - car.yawRate) * Math.min(1, dt * 6);

  const vx = vf * f.x + vr * r.x, vz = vf * f.z + vr * r.z;
  return { x: car.x + vx * dt, z: car.z + vz * dt, heading: car.heading + yawRate * dt, vx, vz, yawRate, steer };
}

// Scoring --------------------------------------------------------------------------------------
export interface Score {
  total: number;        // banked points
  current: number;      // points in the drift (or combo) in progress
  multiplier: number;   // ×1–×5, grows every 2.5 s of continuous drifting
  combo: number;        // seconds drifting in this combo
  grace: number;        // seconds left to start the next drift before the combo banks
  lastEvent: "" | "banked" | "lost" | "spun";
}
export const newScore = (): Score => ({ total: 0, current: 0, multiplier: 1, combo: 0, grace: 0, lastEvent: "" });
export const MAX_POINTS_PER_SECOND = MAX_SPEED * 10 * 5;

/** Drifting is 12°–100° of slip above 8 m/s on the track. Leaving the track loses the combo. */
export function scoreStep(s: Score, angle: number, speed: number, onTrack: boolean, dt: number): Score {
  if (!onTrack && s.current > 0) return { ...s, current: 0, multiplier: 1, combo: 0, grace: 0, lastEvent: "lost" };
  if (angle > 110 && speed > 5 && s.current > 0) return { ...s, current: 0, multiplier: 1, combo: 0, grace: 0, lastEvent: "spun" };
  const drifting = onTrack && speed > 8 && angle >= 12 && angle <= 100;
  if (drifting) {
    const angleFactor = Math.min(1, (angle - 12) / 38); // full credit from 50°
    const combo = s.combo + dt;
    const multiplier = Math.min(5, 1 + Math.floor(combo / 2.5));
    const rate = Math.min(MAX_SPEED, speed) * (0.3 + 0.7 * angleFactor) * 10 * multiplier;
    return { ...s, current: s.current + rate * dt, combo, multiplier, grace: 1.5, lastEvent: "" };
  }
  const grace = s.grace - dt;
  if (grace <= 0 && s.current > 0) return { total: s.total + Math.round(s.current), current: 0, multiplier: 1, combo: 0, grace: 0, lastEvent: "banked" };
  return { ...s, grace: Math.max(0, grace) };
}

/** Ends the run: whatever is in progress is banked. */
export const finalScore = (s: Score) => s.total + Math.round(s.current);

// Track ----------------------------------------------------------------------------------------
export interface Track { points: { x: number; z: number }[]; length: number }

/** A closed loop through the control points (uniform Catmull–Rom), sampled evenly. */
export function buildTrack(control: [number, number][], samples = 600): Track {
  const n = control.length;
  const at = (i: number) => control[((i % n) + n) % n];
  const dense: { x: number; z: number }[] = [];
  const per = Math.ceil(samples / n);
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      dense.push({ x: c(p0[0], p1[0], p2[0], p3[0]), z: c(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  let length = 0;
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i], b = dense[(i + 1) % dense.length];
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return { points: dense, length };
}

/** Distance from the centre line and the nearest point's index. */
export function nearest(track: Track, x: number, z: number): { distance: number; index: number } {
  const pts = track.points;
  let best = Infinity, index = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const abx = b.x - a.x, abz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz || 1)));
    const d = Math.hypot(a.x + abx * t - x, a.z + abz * t - z);
    if (d < best) { best = d; index = i; }
  }
  return { distance: best, index };
}

export const onTrack = (track: Track, x: number, z: number) => nearest(track, x, z).distance <= TRACK_WIDTH / 2 + 0.8;

/** The campus loop: a long straight, a hairpin, sweepers and a chicane. */
export const CAMPUS_LOOP: [number, number][] = ([
  [0, -120], [0, 0], [0, 90], [30, 140], [85, 135], [100, 95], [70, 60], [80, 20], [140, 10],
  [175, -30], [160, -95], [110, -110], [90, -150], [40, -175], [5, -165],
] as [number, number][]).map(([x, z]) => [x * 1.3, z * 1.3]);

export function startingCar(track: Track): Car {
  const a = track.points[0], b = track.points[3];
  return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), vx: 0, vz: 0, yawRate: 0, steer: 0 };
}
