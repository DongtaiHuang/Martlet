"use client";

// Low-poly 3D martlet (prototype). An original swallow-style character, not the McGill crest.
// Expressions come from a Face ref (live camera tracking or a recorded clip); otherwise it idles.
import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ItemId, Plumage } from "@/components/avatar/items";
import { MartletAvatar } from "@/components/avatar/MartletAvatar";
import { fromRow, NEUTRAL, type Clip, type Face } from "./face";

const RED = "#a6192e", CREAM = "#f4efe4", GOLD = "#e3a835", INK = "#15171f";
const PIN_COLORS = ["#f2c14e", "#e67e22", "#4fb3bf", "#c0392b", "#8e7cc3"];

function Mat({ color, ...rest }: { color: string } & Partial<THREE.MeshStandardMaterialParameters>) {
  return <meshStandardMaterial color={color} flatShading roughness={0.75} {...rest} />;
}

type Props = {
  plumage: Plumage; wearing: Set<ItemId>; pins: number;
  live: React.RefObject<Face>; tracking: boolean; clip: Clip | null; playId: number; animate: boolean;
};

function Bird({ plumage, wearing, pins, live, tracking, clip, playId, animate }: Props) {
  const cur = useRef<Face>({ ...NEUTRAL });
  const playStart = useRef<{ id: number; t: number } | null>(null);
  const head = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), jaw = useRef<THREE.Group>(null);
  const eyes = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const brows = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const cheeks = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const wings = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)];
  const nextBlink = useRef(2);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
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
    if (jaw.current) jaw.current.rotation.x = clamp(c.jaw, 0, 1) * 0.65;
    [c.blinkL, c.blinkR].forEach((b, i) => {
      const e = eyes[i].current;
      if (e) e.scale.y = Math.max(0.08, 1 - clamp(b, 0, 1) * 0.95 - c.smile * 0.25);
    });
    brows.forEach((r, i) => {
      const s = i === 0 ? -1 : 1, br = r.current; if (!br) return;
      br.position.y = 0.36 + c.browUp * 0.13 - c.browDown * 0.08;
      br.rotation.z = s * (c.browDown * 0.4 - c.browUp * 0.3);
    });
    cheeks.forEach((r) => r.current?.scale.setScalar(0.1 * (1 + c.smile * 0.9)));
    // Wings follow your arms (0 = down, 1 = overhead); a big grin adds a happy flutter.
    const flutter = c.smile > 0.55 ? Math.abs(Math.sin(t * 16)) * 0.3 * (c.smile - 0.55) * 2 : 0;
    [c.wingL, c.wingR].forEach((lift, i) => {
      const w = wings[i].current; if (!w) return;
      const s = i === 0 ? -1 : 1;
      w.rotation.z = s * (0.12 + clamp(lift, 0, 1) * 2.3 + flutter); // rotate outward and up from the shoulder
    });
    if (body.current) body.current.scale.y = 1 + (animate ? Math.sin(t * 2.2) * 0.012 : 0);
  });

  const leaves = useMemo(() => [[-1.6, 0.18, 0.1], [-1.35, 0.3, -0.2], [1.7, 0.2, 0.05], [1.45, 0.32, 0.25]] as const, []);
  return (
    <group>
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
        <group position={[0, 1.0, -0.78]}>
          <mesh><boxGeometry args={[0.72, 0.82, 0.38]} /><Mat color="#2f6b3a" /></mesh>
          <mesh position={[0, -0.16, -0.2]}><boxGeometry args={[0.52, 0.3, 0.08]} /><Mat color="#245a30" /></mesh>
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
          <group position={[0.18, 0.92, 0.72]} rotation={[0.1, -0.2, 0]}>
            <mesh><boxGeometry args={[0.4, 0.27, 0.16]} /><Mat color="#2b2b2b" /></mesh>
            <mesh position={[0.02, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.09, 0.1, 0.1, 10]} /><Mat color="#4a5568" /></mesh>
          </group>
        )}
        {wearing.has("scarf") && (
          <group position={[0, 1.48, 0.06]}>
            <mesh rotation={[Math.PI / 2 - 0.15, 0, 0]}><torusGeometry args={[0.5, 0.13, 6, 14]} /><Mat color={RED} /></mesh>
            <mesh rotation={[Math.PI / 2 - 0.15, 0, 0]} position={[0, 0.02, 0]}><torusGeometry args={[0.53, 0.035, 4, 14]} /><Mat color={CREAM} /></mesh>
            <mesh position={[0.28, -0.32, 0.42]} rotation={[0.25, 0, 0.12]}><boxGeometry args={[0.2, 0.5, 0.07]} /><Mat color={RED} /></mesh>
          </group>
        )}
      </group>

      {/* Head (tracked) */}
      <group ref={head} position={[0, 1.86, 0.18]}>
        <mesh><icosahedronGeometry args={[0.62, 1]} /><Mat color={plumage.body} /></mesh>
        <mesh position={[0, -0.5, 0.3]} scale={[0.24, 0.11, 0.13]}><icosahedronGeometry args={[1, 1]} /><Mat color={RED} /></mesh>
        {[-1, 1].map((s, i) => (
          <group key={s} position={[s * 0.25, 0.1, 0.5]}>
            <mesh ref={eyes[i]}><sphereGeometry args={[0.16, 12, 10]} /><Mat color="#ffffff" roughness={0.3} /></mesh>
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
        <mesh position={[0, -0.08, 0.72]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.13, 0.42, 5]} /><Mat color={GOLD} /></mesh>
        <group ref={jaw} position={[0, -0.16, 0.56]}>
          <mesh position={[0, -0.02, 0.15]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.6]}><coneGeometry args={[0.1, 0.32, 5]} /><Mat color="#c98d1f" /></mesh>
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
            <mesh position={[0.36, 0.0, 0.36]}><cylinderGeometry args={[0.02, 0.02, 0.3, 4]} /><Mat color={GOLD} /></mesh>
            <mesh position={[0.36, -0.18, 0.36]}><coneGeometry args={[0.05, 0.14, 5]} /><Mat color={GOLD} /></mesh>
          </group>
        )}
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
