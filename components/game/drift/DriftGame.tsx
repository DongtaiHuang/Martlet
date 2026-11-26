"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMapColorMode } from "@/components/map/map-mode";
import { Gamepad, type PadControl } from "@/components/pixel/Gamepad";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { buildTrack, driftAngle, forwardOf, onTrack as isOnTrack, RUN_SECONDS, speedOf, type Score } from "@/lib/drift";
import { startDriftRunAction, submitDriftScoreAction } from "@/app/play/drift/actions";
import type { SubmitResult } from "@/lib/drift-scores";
import { Coupe, PAINTS, type Paint } from "./Coupe";
import { DriftEngine, SmokePool, type TouchKey } from "./engine";
import { DRIFT_SCORE_EVENT } from "./events";
import { TrackScene } from "./TrackScene";
import { PIXEL_CANVAS } from "@/components/pixel/pixel3d";
import { STREET_LOOP } from "@/lib/drift-streets";
import type { Map as MapLibre } from "maplibre-gl";
import { DRIFT_FOV, createDriftMap, syncDriftMap } from "./drift-map";

// The real-street loop around campus (ADR 0047).
const TRACK = buildTrack(STREET_LOOP);
type Phase = "ready" | "countdown" | "running" | "paused" | "done";
interface Hud { score: number; current: number; multiplier: number; angle: number; speed: number; time: number; event: Score["lastEvent"]; offTrack: boolean }
const EMPTY_HUD: Hud = { score: 0, current: 0, multiplier: 1, angle: 0, speed: 0, time: RUN_SECONDS, event: "", offTrack: false };
const SMOKE = 48, SKIDS = 1400;

/** Moves the car, wheels, camera, smoke and skid marks each frame, and advances the engine while running. */
function World({ engine, phase, paint, onHud, onFinish, mapRef }: { engine: DriftEngine; phase: Phase; paint: Paint; onHud: (h: Hud) => void; onFinish: () => void; mapRef: React.RefObject<MapLibre | null> }) {
  const car = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Object3D[]>([]);
  const { camera } = useThree();
  const smoke = useMemo(() => new SmokePool(SMOKE), []);
  const skids = useRef<THREE.InstancedMesh>(null);
  const skidIndex = useRef(0);
  const timers = useRef({ skid: 0, smoke: 0, hud: -1 });
  const temp = useMemo(() => new THREE.Object3D(), []);
  const reduce = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    // Find the wheels by name (front two first) and hide every skid mark to start.
    wheels.current = [0, 1, 2, 3].map((i) => car.current?.getObjectByName("wheel-" + i)).filter((w): w is THREE.Object3D => Boolean(w));
    const m = skids.current;
    if (!m) return;
    temp.position.set(0, -10, 0); temp.updateMatrix();
    for (let i = 0; i < SKIDS; i++) m.setMatrixAt(i, temp.matrix);
    m.instanceMatrix.needsUpdate = true;
  }, [temp]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    if (phase === "running" && engine.advance(dt)) onFinish();

    const c = engine.car;
    const speed = speedOf(c);
    if (car.current) {
      car.current.position.set(c.x, 0, c.z);
      car.current.rotation.y = c.heading;
      car.current.rotation.z = Math.max(-0.06, Math.min(0.06, -c.yawRate * speed * 0.004)); // body roll
    }
    wheels.current.forEach((w, i) => {
      w.children[0].rotation.x += (speed / 0.36) * dt;
      if (i < 2) w.rotation.y = c.steer * 0.45;
    });

    // Chase camera, swung toward the direction of travel so drifts read clearly.
    const f = forwardOf(c.heading);
    const vdir = speed > 3 ? { x: c.vx / speed, z: c.vz / speed } : f;
    const bx = f.x * 0.55 + vdir.x * 0.45, bz = f.z * 0.55 + vdir.z * 0.45;
    camera.position.lerp(new THREE.Vector3(c.x - bx * 10.5, 4.4 + speed * 0.03, c.z - bz * 10.5), phase === "ready" ? 1 : 1 - Math.exp(-dt * 4.5));
    camera.lookAt(c.x + f.x * 4, 1, c.z + f.z * 4);
    // The real campus underneath follows the same camera.
    if (mapRef.current) syncDriftMap(mapRef.current, camera.position, { x: c.x + f.x * 4, y: 1, z: c.z + f.z * 4 });

    // Smoke and skid marks from the rear tyres while sliding.
    const angle = driftAngle(c);
    const t = timers.current;
    if (phase === "running" && speed > 6 && angle > 10) {
      const r = { x: Math.cos(c.heading), z: -Math.sin(c.heading) };
      const rear = [-1, 1].map((side) => ({ x: c.x - f.x * 1.4 + r.x * 0.9 * side, z: c.z - f.z * 1.4 + r.z * 0.9 * side }));
      t.skid += dt;
      if (t.skid > 0.025 && skids.current) {
        t.skid = 0;
        for (const p of rear) {
          temp.position.set(p.x, 0.02, p.z);
          temp.rotation.set(-Math.PI / 2, 0, -Math.atan2(c.vx, c.vz));
          temp.scale.set(1, Math.max(0.6, speed * 0.03), 1);
          temp.updateMatrix();
          skids.current.setMatrixAt(skidIndex.current, temp.matrix);
          skidIndex.current = (skidIndex.current + 1) % SKIDS;
        }
        skids.current.instanceMatrix.needsUpdate = true;
      }
      t.smoke += dt;
      if (!reduce && t.smoke > 0.035) {
        t.smoke = 0;
        for (const p of rear) smoke.emit(p.x, p.z, -c.vx * 0.08 + (Math.random() - 0.5), -c.vz * 0.08 + (Math.random() - 0.5));
      }
    }
    smoke.update(dt, camera.quaternion);

    // HUD at 10 Hz.
    if (engine.time - t.hud > 0.1 || phase !== "running") {
      t.hud = engine.time;
      onHud({
        score: engine.score.total, current: Math.round(engine.score.current), multiplier: engine.score.multiplier, angle: Math.round(angle),
        speed: Math.round(speed * 3.6), time: Math.max(0, RUN_SECONDS - engine.time),
        event: engine.time - engine.eventAt < 1.6 ? engine.score.lastEvent : "", offTrack: phase === "running" && !isOnTrack(TRACK, c.x, c.z),
      });
    }
  });

  return (
    <>
      <TrackScene track={TRACK} scenery={false} />
      <instancedMesh ref={skids} args={[undefined, undefined, SKIDS]} frustumCulled={false}>
        <planeGeometry args={[0.28, 0.5]} />
        <meshBasicMaterial color="#1b1b1b" transparent opacity={0.55} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </instancedMesh>
      {Array.from({ length: SMOKE }, (_, i) => (
        <mesh key={i} ref={(m) => smoke.attach(i, m)} visible={false}>
          <circleGeometry args={[0.5, 16]} />
          <meshBasicMaterial color="#e8e8e8" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
      <group ref={car}>
        <Coupe paint={paint} />
      </group>
    </>
  );
}

const fmt = (n: number) => n.toLocaleString("en-CA");

/** Martlet Drift (issue #149, ADR 0037): a 90-second drift run on the campus loop. */
export default function DriftGame({ signedIn }: { signedIn: boolean }) {
  const engine = useMemo(() => new DriftEngine(TRACK), []);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  useMapColorMode(mapRef);
  useEffect(() => {
    if (!mapEl.current) return;
    const map = createDriftMap(mapEl.current);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapEl.current);
    mapRef.current = map;
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const [paint, setPaint] = useState<Paint>(PAINTS[0]);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<{ score: number; saved: SubmitResult | null } | null>(null);
  const runId = useRef<string | null>(null);
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const box = useRef<HTMLDivElement>(null);

  const go = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  // Keyboard: arrows/WASD, Space = handbrake, P/Escape = pause.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((key === "p" || key === "escape") && (phaseRef.current === "running" || phaseRef.current === "paused")) {
        go(phaseRef.current === "running" ? "paused" : "running");
        return;
      }
      if (phaseRef.current === "running" && engine.key(key, true)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { engine.key(e.key, false); };
    const away = () => { engine.release(); if (phaseRef.current === "running") go("paused"); };
    const hidden = () => { if (document.hidden) away(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", away);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", away); document.removeEventListener("visibilitychange", hidden);
    };
  }, [engine]);

  async function start() {
    engine.reset();
    setResult(null);
    setHud(EMPTY_HUD);
    runId.current = signedIn ? await startDriftRunAction() : null;
    go("countdown");
    box.current?.focus();
    for (const n of [3, 2, 1]) { setCount(n); await new Promise((r) => setTimeout(r, 700)); }
    go("running");
  }

  async function finish() {
    if (phaseRef.current !== "running") return;
    go("done");
    const score = engine.final();
    setResult({ score, saved: null });
    if (runId.current) {
      const saved = await submitDriftScoreAction(runId.current, score);
      runId.current = null;
      setResult({ score, saved });
      window.dispatchEvent(new Event(DRIFT_SCORE_EVENT));
    }
  }

  // The gamepad (phones): D-pad steers (up gas, down brake), A is gas, B is the handbrake.
  const PAD: Record<PadControl, TouchKey> = { left: "left", right: "right", up: "gas", down: "brake", a: "gas", b: "drift" };
  const onPad = (c: PadControl, on: boolean) => engine.setTouch(PAD[c], on);

  return (
    <div>
    <div ref={box} tabIndex={-1} className="relative aspect-square w-full overflow-hidden rounded-3xl bg-[#86b0d8] outline-none sm:aspect-[16/10]">
      {/* The real campus (MapLibre) under a transparent three.js layer for the car and the road. */}
      <div className="absolute inset-0" style={{ imageRendering: "pixelated" }} aria-hidden="true">
        <div ref={mapEl} className="size-full" />
      </div>
      <Canvas camera={{ fov: DRIFT_FOV, near: 0.5, far: 900, position: [0, 6, -150] }} dpr={PIXEL_CANVAS.dpr} gl={{ ...PIXEL_CANVAS.gl, alpha: true }}
        style={{ ...PIXEL_CANVAS.style, position: "absolute", inset: 0 }} aria-hidden="true">
        <hemisphereLight args={["#ffffff", "#4b6b3a", 1.1]} />
        <directionalLight position={[80, 120, 40]} intensity={1.6} />
        <World engine={engine} phase={phase} paint={paint} onHud={setHud} onFinish={() => void finish()} mapRef={mapRef} />
      </Canvas>

      {/* HUD */}
      {(phase === "running" || phase === "paused") && (
        <div className="pointer-events-none absolute inset-0 p-3 text-white sm:p-4" aria-hidden="true">
          <div className="flex items-start justify-between gap-2">
            <div className="rounded-xl bg-black/45 px-3 py-1.5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Score</p>
              <p className="text-2xl font-extrabold tabular-nums">{fmt(hud.score)}</p>
            </div>
            <div className={`rounded-xl px-3 py-1.5 text-center backdrop-blur-sm transition ${hud.current > 0 ? "bg-amber-400/90 text-neutral-900" : "bg-black/30"}`}>
              {hud.current > 0 ? (
                <>
                  <p className="text-xl font-extrabold tabular-nums">+{fmt(hud.current)} <span className="text-base">×{hud.multiplier}</span></p>
                  <p className="text-[11px] font-bold">{hud.angle}° drift</p>
                </>
              ) : <p className="text-xs font-semibold text-white/80">Handbrake into a corner to drift</p>}
            </div>
            <div className="rounded-xl bg-black/45 px-3 py-1.5 text-right backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Time</p>
              <p className={`text-2xl font-extrabold tabular-nums ${hud.time < 10 ? "text-amber-300" : ""}`}>{hud.time.toFixed(1)}</p>
            </div>
          </div>
          {(hud.event || hud.offTrack) && (
            <p key={hud.event + hud.offTrack} className="bj-land mx-auto mt-4 w-fit rounded-xl bg-black/55 px-4 py-2 text-lg font-extrabold">
              {hud.offTrack ? "Off track!" : hud.event === "banked" ? "Combo banked!" : hud.event === "lost" ? "Combo lost" : "Spun out!"}
            </p>
          )}
          <p className="absolute bottom-3 left-3 rounded-lg bg-black/45 px-2.5 py-1 text-sm font-bold tabular-nums sm:bottom-4 sm:left-4">{hud.speed} km/h</p>
        </div>
      )}

      {(phase === "running" || phase === "paused") && (
        <button type="button" onClick={() => go(phase === "running" ? "paused" : "running")}
          className="absolute top-20 right-3 rounded-lg bg-black/45 px-3 py-1.5 text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-white sm:top-24 sm:right-4">
          {phase === "running" ? "Pause" : "Resume"}
        </button>
      )}

      {/* Overlays */}
      {phase === "countdown" && (
        <p key={count} className="bj-land absolute inset-0 grid place-items-center text-8xl font-extrabold text-white drop-shadow-lg" aria-live="assertive">{count}</p>
      )}
      {(phase === "ready" || phase === "paused" || phase === "done") && (
        <div className="absolute inset-0 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-5 text-ink shadow-xl">
            {phase === "done" && result ? (
              <div aria-live="polite">
                <h2 className="text-xl font-extrabold">Run complete</h2>
                <p className="mt-1 text-4xl font-extrabold tabular-nums">{fmt(result.score)}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {!signedIn ? "Sign in to put your score on the leaderboard."
                    : result.saved === null ? "Saving…"
                    : result.saved === "new-best" ? "New personal best!"
                    : result.saved === "saved" ? "Saved. Your best is still higher."
                    : "This run couldn’t be saved."}
                </p>
              </div>
            ) : phase === "paused" ? (
              <h2 className="text-xl font-extrabold">Paused</h2>
            ) : (
              <>
                <h2 className="text-xl font-extrabold">Drift run · {RUN_SECONDS} s</h2>
                <p className="mt-1 text-sm text-ink-2">Slide round Sherbrooke, University, Pine and McTavish. Longer, wider, faster drifts score more, and chaining them builds a combo up to ×5. Leave the track or spin out and the combo’s gone.</p>
              </>
            )}
            {phase !== "paused" && (
              <fieldset className="mt-4">
                <legend className="text-sm font-bold">Paint</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PAINTS.map((p) => (
                    <label key={p.name} className="cursor-pointer" title={p.name}>
                      <input type="radio" name="paint" className="peer sr-only" checked={paint.name === p.name} onChange={() => setPaint(p)} />
                      <span className="sr-only">{p.name}</span>
                      <span aria-hidden="true" className="block size-9 rounded-full border-2 border-line ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-brand peer-focus-visible:outline-2 peer-focus-visible:outline-focus" style={{ background: p.color }} />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {phase === "paused" && (
                <button type="button" onClick={() => go("running")} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Resume</button>
              )}
              <button type="button" onClick={() => void start()} className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${phase === "paused" ? "border border-line-strong text-ink-2 hover:border-brand" : "bg-brand text-on-brand hover:bg-brand-hover"}`}>
                {phase === "ready" ? "Start" : phase === "paused" ? "Restart" : "Drive again"}
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              {touch ? "Hold A for gas, steer with the D-pad, tap B to drift into a corner." : "W/↑ gas · S/↓ brake · A D/← → steer · Space handbrake · P pause"}
            </p>
          </div>
        </div>
      )}
    </div>
    <Gamepad onChange={onPad} a="Gas" b="Drift" title="Martlet Drift" />
    </div>
  );
}
