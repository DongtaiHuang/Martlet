"use client";

// Low-poly 3D martlet (prototype). An original swallow-style character, not the McGill crest.
// Expressions come from a Face ref (live camera tracking or a recorded clip); otherwise it idles.
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ItemId, Plumage } from "@/components/avatar/items";
import { MartletAvatar } from "@/components/avatar/MartletAvatar";
import { fromRow, NEUTRAL, type Clip, type Face } from "./face";

const RED = "#a6192e", CREAM = "#f4efe4", GOLD = "#e3a835", INK = "#15171f";
const PIN_COLORS = ["#f2c14e", "#e67e22", "#4fb3bf", "#c0392b", "#8e7cc3"];

function Mat({ color, ...rest }: { color: string } & Partial<THREE.MeshStandardMaterialParameters>) {
  return <meshStandardMaterial color={color} flatShading roughness={0.75} {...rest} />;
}

/** Drag (mouse/touch) or arrow keys to turn the martlet around; eases toward the target angle. */
function useOrbit() {
  const { gl } = useThree();
  const targetRef = useRef({ yaw: 0, pitch: 0 });
  useEffect(() => {
    const el = gl.domElement;
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", "Martlet viewer. Drag or use arrow keys to turn it around. Home resets.");
    el.style.setProperty("touch-action", "pan-y"); // vertical swipes still scroll the page on phones
    let last: { x: number; y: number } | null = null;
    const t = targetRef.current;
    const reset = () => { t.yaw = 0; t.pitch = 0; };
    const down = (e: PointerEvent) => { last = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!last) return;
      t.yaw += (e.clientX - last.x) * 0.012;
      t.pitch = THREE.MathUtils.clamp(t.pitch + (e.clientY - last.y) * 0.006, -0.35, 0.45);
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => { last = null; };
    const steps: Record<string, [number, number]> = { ArrowLeft: [-0.3, 0], ArrowRight: [0.3, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] };
    const key = (e: KeyboardEvent) => {
      const step = steps[e.key];
      if (step) { e.preventDefault(); t.yaw += step[0]; t.pitch = THREE.MathUtils.clamp(t.pitch + step[1], -0.35, 0.45); }
      if (e.key === "Home") reset();
    };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("keydown", key); el.addEventListener("dblclick", reset);
    return () => {
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      el.removeEventListener("keydown", key); el.removeEventListener("dblclick", reset);
    };
  }, [gl]);
  return targetRef;
}

type Props = {
  plumage: Plumage; wearing: Set<ItemId>; pins: number;
  live: React.RefObject<Face>; tracking: boolean; clip: Clip | null; playId: number; animate: boolean;
};

function Bird({ plumage, wearing, pins, live, tracking, clip, playId, animate }: Props) {
  const cur = useRef<Face>({ ...NEUTRAL });
  const playStart = useRef<{ id: number; t: number } | null>(null);
  const head = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), jaw = useRef<THREE.Group>(null);
  const eyes = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]; // whole eye: white + pupil + highlight
  const brows = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const cheeks = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const wings = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const beak = useRef<THREE.Group>(null), tongue = useRef<THREE.Mesh>(null);
  const nextBlink = useRef(2);
  const spin = useRef<THREE.Group>(null);
  const orbitRef = useOrbit();

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (spin.current) { // ease toward the dragged angle
      spin.current.rotation.y += (orbitRef.current.yaw - spin.current.rotation.y) * 0.15;
      spin.current.rotation.x += (orbitRef.current.pitch - spin.current.rotation.x) * 0.15;
    }
    // 1. Pick the target expression: live tracking > recorded clip > idle.
    let target: Face = NEUTRAL;
    if (tracking) target = live.current;
    else if (clip && playId > 0) {
      if (playStart.current?.id !== playId) playStart.current = { id: playId, t };
      const i = Math.floor((t - playStart.current.t) * clip.fps);
      if (i < clip.frames.length) target = fromRow(clip.frames[i]);
    } else if (animate) {
      const blinking = t > nextBlink.current && t < nextBlink.current + 0.14;
      if (t > nextBlink.current + 0.14) nextBlink.current = t + 2.5 + Math.random() * 3;
      target = { ...NEUTRAL, blinkL: blinking ? 1 : 0, blinkR: blinking ? 1 : 0, yaw: Math.sin(t * 0.4) * 0.15, pitch: Math.sin(t * 0.6) * 0.04 };
    }
    // 2. Smooth toward it so tracking jitter doesn't show.
    const c = cur.current, k = tracking ? 0.45 : 0.3;
    for (const key of Object.keys(c) as (keyof Face)[]) c[key] += ((target[key] ?? 0) - c[key]) * k;

    // 3. Drive the rig.
    const clamp = THREE.MathUtils.clamp;
    if (head.current) head.current.rotation.set(clamp(c.pitch, -0.5, 0.5), clamp(c.yaw, -0.8, 0.8), clamp(c.roll, -0.5, 0.5));
    const tongueOut = clamp(c.tongue, 0, 1);
    // Sticking your tongue out opens the beak at least a little so the tongue shows.
    if (jaw.current) jaw.current.rotation.x = Math.max(clamp(c.jaw, 0, 1), tongueOut * 0.45) * 0.65;
    if (tongue.current) {
      tongue.current.visible = tongueOut > 0.05;
      tongue.current.position.set(0, -0.04 - tongueOut * 0.05, 0.1 + tongueOut * 0.22);
      tongue.current.scale.set(0.075, 0.03, 0.06 + tongueOut * 0.13);
    }
    if (beak.current) { // pucker narrows and pushes the beak forward; mouth sideways shifts it
      beak.current.scale.x = 1 - clamp(c.pucker, 0, 1) * 0.35;
      beak.current.position.set(clamp(c.mouthX, -1, 1) * 0.09, 0, clamp(c.pucker, 0, 1) * 0.08);
    }
    const wide = 1 + clamp(c.wide, 0, 1) * 0.28;
    [c.blinkL, c.blinkR].forEach((b, i) => {
      const e = eyes[i].current; if (!e) return;
      const open = 1 - clamp(b, 0, 1) * 0.95 - c.smile * 0.25 - c.squint * 0.4 - c.frown * 0.18;
      e.scale.set(wide, Math.max(0.08, open * wide), wide);
    });
    brows.forEach((r, i) => {
      const s = i === 0 ? -1 : 1, br = r.current; if (!br) return;
      br.position.y = 0.36 + c.browUp * 0.13 + c.wide * 0.06 - c.browDown * 0.08;
      br.rotation.z = s * (c.browDown * 0.4 - (c.browUp + c.frown * 0.9) * 0.3); // frown = sad, inner ends up
    });
    cheeks.forEach((r) => r.current?.scale.setScalar(0.1 * (1 + c.smile * 0.9 + clamp(c.puff, 0, 1) * 1.6)));
    // Wings follow your arms (0 = down, 1 = overhead); a big grin adds a happy flutter.
    const flutter = c.smile > 0.55 ? Math.abs(Math.sin(t * 16)) * 0.3 * (c.smile - 0.55) * 2 : 0;
    [[c.wingL, c.swingL, c.bendL], [c.wingR, c.swingR, c.bendR]].forEach(([lift, swing, bend], i) => {
      const w = wings[i].current; if (!w) return;
      const s = i === 0 ? -1 : 1;
      // From the shoulder: swing forward/back (x), then raise outward/up (z); a bent elbow folds the wing in.
      w.rotation.set(-clamp(swing, -1, 1) * 1.3 - bend * 0.35, 0, s * (0.12 + clamp(lift, 0, 1) * 2.3 + flutter), "ZXY");
      w.scale.y = 1 - clamp(bend, 0, 1) * 0.3;
    });
    if (body.current) body.current.scale.y = 1 + (animate ? Math.sin(t * 2.2) * 0.012 : 0);
  });

  const leaves = useMemo(() => [[-1.6, 0.18, 0.1], [-1.35, 0.3, -0.2], [1.7, 0.2, 0.05], [1.45, 0.32, 0.25]] as const, []);
  return (
    <group ref={spin} position={[0, 1.1, 0]}>
    <group position={[0, -1.1, 0]}>
      {/* Branch */}
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.11, 0.14, 4.2, 7]} /><Mat color="#5b4031" /></mesh>
      {leaves.map((p, i) => <mesh key={i} position={p as unknown as [number, number, number]} scale={[0.22, 0.08, 0.14]}><icosahedronGeometry args={[1, 0]} /><Mat color={i % 2 ? "#6b8f4e" : "#7aa35a"} /></mesh>)}

      {/* Feet */}
      {[-0.18, 0.18].map((x) => <mesh key={x} position={[x, 0.3, 0.1]}><cylinderGeometry args={[0.035, 0.035, 0.4, 5]} /><Mat color="#3a2a20" /></mesh>)}

      {/* Tail: forked */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.16, 0.55, -0.8]} rotation={[-2.15, 0, s * 0.28]}><coneGeometry args={[0.13, 1.05, 4]} /><Mat color={plumage.wing} /></mesh>
      ))}

      {wearing.has("backpack") && (
        <group>
          <group position={[0, 1.02, -1.02]} rotation={[-0.12, 0, 0]}>
            <mesh><boxGeometry args={[0.7, 0.8, 0.34]} /><Mat color="#2f6b3a" /></mesh>
            <mesh position={[0, 0.34, 0.02]}><boxGeometry args={[0.72, 0.16, 0.38]} /><Mat color="#245a30" /></mesh>
            <mesh position={[0, -0.14, -0.2]}><boxGeometry args={[0.5, 0.3, 0.08]} /><Mat color="#245a30" /></mesh>
          </group>
          {/* Shoulder straps, visible from the front */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.36, 1.2, 0.52]} rotation={[-0.35, 0, s * 0.12]}><boxGeometry args={[0.09, 0.5, 0.05]} /><Mat color="#245a30" /></mesh>
          ))}
        </group>
      )}

      <group ref={body}>
        <mesh position={[0, 0.95, -0.08]} scale={[0.74, 0.8, 0.88]}><icosahedronGeometry args={[1, 1]} /><Mat color={plumage.body} /></mesh>
        <mesh position={[0, 0.92, 0.5]} scale={[0.5, 0.56, 0.4]}><icosahedronGeometry args={[1, 1]} /><Mat color={CREAM} /></mesh>
        {[-1, 1].map((s, i) => (
          <group key={s} ref={wings[i]} position={[s * 0.55, 1.36, -0.12]}>
            <mesh position={[s * 0.07, -0.42, 0]} scale={[0.17, 0.5, 0.7]} rotation={[0.15, 0, 0]}><icosahedronGeometry args={[1, 1]} /><Mat color={plumage.wing} /></mesh>
            {/* Landmark pins ride on the right-hand wing so they move with it. */}
            {s === 1 && Array.from({ length: pins }, (_, p) => (
              <mesh key={p} position={[0.25, -0.22 - p * 0.13, 0.12 - (p % 2) * 0.12]} scale={0.055}><icosahedronGeometry args={[1, 0]} /><Mat color={PIN_COLORS[p]} emissive={PIN_COLORS[p]} emissiveIntensity={0.15} /></mesh>
            ))}
          </group>
        ))}
        {wearing.has("camera") && (
          <group>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.17, 1.24, 0.78]} rotation={[-0.45, 0, s * -0.5]}><cylinderGeometry args={[0.018, 0.018, 0.42, 4]} /><Mat color="#2b2b2b" /></mesh>
            ))}
            <group position={[0, 1.0, 0.95]} rotation={[-0.12, 0, 0]}>
              <mesh><boxGeometry args={[0.42, 0.28, 0.18]} /><Mat color="#2b2b2b" /></mesh>
              <mesh position={[-0.1, 0.17, 0]}><boxGeometry args={[0.12, 0.07, 0.12]} /><Mat color="#2b2b2b" /></mesh>
              <mesh position={[0.02, -0.01, 0.12]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.1, 0.11, 0.1, 12]} /><Mat color="#4a5568" /></mesh>
              <mesh position={[0.02, -0.01, 0.175]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.065, 0.065, 0.02, 12]} /><meshStandardMaterial color="#1a202c" roughness={0.1} metalness={0.4} /></mesh>
              <mesh position={[0.15, 0.08, 0.095]}><boxGeometry args={[0.05, 0.03, 0.02]} /><Mat color="#f6e05e" /></mesh>
            </group>
          </group>
        )}
        {wearing.has("scarf") && (
          <group position={[0, 1.42, 0.05]}>
            <group scale={[1, 1, 1.18]}>
              <mesh rotation={[Math.PI / 2 - 0.12, 0, 0]}><torusGeometry args={[0.6, 0.13, 6, 16]} /><Mat color={RED} /></mesh>
              <mesh rotation={[Math.PI / 2 - 0.12, 0, 0]}><torusGeometry args={[0.66, 0.035, 4, 16]} /><Mat color={CREAM} /></mesh>
            </group>
            {/* Knot and hanging tail at the front */}
            <mesh position={[0.26, -0.05, 0.72]}><icosahedronGeometry args={[0.12, 0]} /><Mat color={RED} /></mesh>
            <group position={[0.3, -0.36, 0.82]} rotation={[0.12, 0, 0.18]}>
              <mesh><boxGeometry args={[0.2, 0.52, 0.07]} /><Mat color={RED} /></mesh>
              <mesh position={[0, -0.15, 0.04]}><boxGeometry args={[0.2, 0.05, 0.01]} /><Mat color={CREAM} /></mesh>
              <mesh position={[0, -0.24, 0.04]}><boxGeometry args={[0.2, 0.05, 0.01]} /><Mat color={CREAM} /></mesh>
            </group>
          </group>
        )}
      </group>

      {/* Head (tracked) */}
      <group ref={head} position={[0, 1.86, 0.18]}>
        <mesh><icosahedronGeometry args={[0.62, 1]} /><Mat color={plumage.body} /></mesh>
        <mesh position={[0, -0.5, 0.3]} scale={[0.24, 0.11, 0.13]}><icosahedronGeometry args={[1, 1]} /><Mat color={RED} /></mesh>
        {[-1, 1].map((s, i) => (
          <group key={s} ref={eyes[i]} position={[s * 0.25, 0.1, 0.5]}>
            <mesh><sphereGeometry args={[0.16, 12, 10]} /><Mat color="#ffffff" roughness={0.3} /></mesh>
            <mesh position={[0, 0, 0.12]}><sphereGeometry args={[0.075, 12, 10]} /><meshStandardMaterial color={INK} roughness={0.2} /></mesh>
            <mesh position={[0.03, 0.035, 0.19]}><sphereGeometry args={[0.022, 6, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
          </group>
        ))}
        {[-1, 1].map((s, i) => (
          <mesh key={s} ref={brows[i]} position={[s * 0.25, 0.36, 0.5]}><boxGeometry args={[0.24, 0.05, 0.06]} /><Mat color={INK} /></mesh>
        ))}
        {[-1, 1].map((s, i) => (
          <mesh key={s} ref={cheeks[i]} position={[s * 0.42, -0.14, 0.38]} scale={0.1}><sphereGeometry args={[1, 8, 6]} /><Mat color="#f4a3a8" transparent opacity={0.8} /></mesh>
        ))}
        {/* Beak: upper fixed, lower opens with your jaw */}
        <group ref={beak}>
          <mesh position={[0, -0.08, 0.72]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.13, 0.42, 5]} /><Mat color={GOLD} /></mesh>
          <group ref={jaw} position={[0, -0.16, 0.56]}>
            <mesh position={[0, -0.02, 0.15]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.6]}><coneGeometry args={[0.1, 0.32, 5]} /><Mat color="#c98d1f" /></mesh>
            <mesh ref={tongue} visible={false}><icosahedronGeometry args={[1, 1]} /><Mat color="#e86a7f" roughness={0.5} /></mesh>
          </group>
        </group>
        {wearing.has("beanie") && (
          <group position={[0, 0.3, 0]}>
            <mesh><sphereGeometry args={[0.6, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><Mat color={RED} side={THREE.DoubleSide} /></mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.6, 0.075, 5, 14]} /><Mat color={CREAM} /></mesh>
            <mesh position={[0, 0.64, 0]}><icosahedronGeometry args={[0.13, 1]} /><Mat color={CREAM} /></mesh>
          </group>
        )}
        {wearing.has("gradcap") && (
          <group position={[0, 0.5, 0]}>
            <mesh><cylinderGeometry args={[0.42, 0.46, 0.26, 8]} /><Mat color="#1a1a1a" /></mesh>
            <mesh position={[0, 0.16, 0]} rotation={[0, Math.PI / 4, 0]}><boxGeometry args={[1.0, 0.06, 1.0]} /><Mat color="#222" /></mesh>
            <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.05, 0.05, 0.03, 8]} /><Mat color={GOLD} /></mesh>
            <mesh position={[0.25, 0.2, 0.25]} rotation={[0, -Math.PI / 4, Math.PI / 2]}><cylinderGeometry args={[0.015, 0.015, 0.7, 4]} /><Mat color={GOLD} /></mesh>
            <mesh position={[0.5, 0.02, 0.5]}><cylinderGeometry args={[0.015, 0.015, 0.36, 4]} /><Mat color={GOLD} /></mesh>
            <mesh position={[0.5, -0.2, 0.5]} rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.06, 0.16, 6]} /><Mat color={GOLD} /></mesh>
          </group>
        )}
      </group>
    </group>
    </group>
  );
}

export default function Martlet3D(props: Props & { name: string }) {
  return (
    <div className="aspect-square w-full max-w-[520px] overflow-hidden rounded-3xl bg-gradient-to-b from-amber-50 to-stone-100">
      <Canvas
        dpr={[1, 2]} camera={{ position: [0, 2.0, 6.3], fov: 36 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.15, 0)}
        fallback={<MartletAvatar plumage={props.plumage} wearing={props.wearing} pins={props.pins} size={480} title={`${props.name}’s martlet`} />}
        aria-label={`${props.name}’s martlet`}
      >
        <hemisphereLight args={["#fff8ec", "#b9a888", 1.2]} />
        <directionalLight position={[3, 5, 4]} intensity={1.7} />
        <directionalLight position={[-4, 2, -2]} intensity={0.4} color="#ffd9b0" />
        <Bird {...props} />
      </Canvas>
    </div>
  );
}
