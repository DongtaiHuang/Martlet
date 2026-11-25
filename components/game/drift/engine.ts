import type * as THREE from "three";
import {
  driftAngle, finalScore, newScore, onTrack, RUN_SECONDS, scoreStep, speedOf, startingCar, step,
  type Car, type Controls, type Score, type Track,
} from "@/lib/drift";

const DT = 1 / 120;
export type TouchKey = "left" | "right" | "gas" | "brake" | "drift";
const GAME_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "w", "a", "s", "d"]);

/**
 * The mutable game state, advanced at a fixed 120 Hz by the render loop. Kept outside React state
 * (which only mirrors it for the HUD) so a frame never waits on a re-render.
 */
export class DriftEngine {
  car!: Car;
  score!: Score;
  time = 0;
  eventAt = -10;
  private acc = 0;
  private keys = new Set<string>();
  private touch: Record<TouchKey, boolean> = { left: false, right: false, gas: false, brake: false, drift: false };

  constructor(readonly track: Track) { this.reset(); }

  reset() {
    this.car = startingCar(this.track);
    this.score = newScore();
    this.time = 0;
    this.acc = 0;
    this.eventAt = -10;
    this.release();
  }

  /** Returns true if the key is a game key (so the page shouldn't scroll). */
  key(key: string, down: boolean): boolean {
    const k = key.toLowerCase();
    if (!GAME_KEYS.has(k)) return false;
    if (down) this.keys.add(k); else this.keys.delete(k);
    return true;
  }
  setTouch(k: TouchKey, down: boolean) { this.touch[k] = down; }
  release() { this.keys.clear(); for (const k of Object.keys(this.touch) as TouchKey[]) this.touch[k] = false; }

  controls(): Controls {
    const k = this.keys, t = this.touch;
    const left = k.has("arrowleft") || k.has("a") || t.left, right = k.has("arrowright") || k.has("d") || t.right;
    return {
      throttle: k.has("arrowup") || k.has("w") || t.gas ? 1 : 0,
      brake: k.has("arrowdown") || k.has("s") || t.brake ? 1 : 0,
      // The camera looks down +z, so screen-right is the car's negative steer.
      steer: (left ? 1 : 0) - (right ? 1 : 0),
      handbrake: k.has(" ") || t.drift,
    };
  }

  /** Runs whole physics steps for `dt` seconds. Returns true when the run's time is up. */
  advance(dt: number): boolean {
    this.acc += dt;
    while (this.acc >= DT) {
      this.acc -= DT;
      const on = onTrack(this.track, this.car.x, this.car.z);
      this.car = step(this.car, this.controls(), DT, on);
      const prev = this.score.lastEvent;
      this.score = scoreStep(this.score, driftAngle(this.car), speedOf(this.car), on, DT);
      if (this.score.lastEvent && this.score.lastEvent !== prev) this.eventAt = this.time;
      this.time += DT;
      if (this.time >= RUN_SECONDS) return true;
    }
    return false;
  }

  final() { return finalScore(this.score); }
}

/** Recycled smoke puffs: spawned at the rear tyres, they drift, grow and fade. */
export class SmokePool {
  private puffs: { mesh: THREE.Mesh | null; life: number; vx: number; vz: number }[];
  private next = 0;
  constructor(readonly size: number) {
    this.puffs = Array.from({ length: size }, () => ({ mesh: null, life: 0, vx: 0, vz: 0 }));
  }
  attach(i: number, mesh: THREE.Mesh | null) { this.puffs[i].mesh = mesh; }
  emit(x: number, z: number, vx: number, vz: number) {
    const p = this.puffs[this.next];
    this.next = (this.next + 1) % this.size;
    if (!p.mesh) return;
    p.life = 1; p.vx = vx; p.vz = vz;
    p.mesh.position.set(x, 0.35, z);
  }
  update(dt: number, facing: THREE.Quaternion) {
    for (const p of this.puffs) {
      if (!p.mesh) continue;
      p.life = Math.max(0, p.life - dt * 0.9);
      p.mesh.visible = p.life > 0;
      if (p.life <= 0) continue;
      p.mesh.position.x += p.vx * dt; p.mesh.position.z += p.vz * dt; p.mesh.position.y += dt * 0.8;
      p.mesh.scale.setScalar(0.8 + (1 - p.life) * 3.2);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life * 0.3;
      p.mesh.quaternion.copy(facing);
    }
  }
}
