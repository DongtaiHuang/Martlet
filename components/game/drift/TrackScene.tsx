"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { nearest, TRACK_WIDTH, type Track } from "@/lib/drift";

/** A ribbon `from`–`to` metres either side of the centre line, optionally striped. */
function ribbon(track: Track, inner: number, outer: number, side: 1 | -1, colors?: [THREE.Color, THREE.Color]) {
  const pts = track.points, n = pts.length;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * side, nz = dx / len * side;
    pos.push(p.x + nx * inner, 0.01, p.z + nz * inner, p.x + nx * outer, 0.01, p.z + nz * outer);
    if (colors) { const c = colors[Math.floor(i / 3) % 2]; col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (colors) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Deterministic scatter so the scenery is the same every visit. */
function scatter(track: Track, count: number, clearance: number, seed: number) {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const out: { x: number; z: number; r: number; s: number }[] = [];
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const x = -120 + rand() * 400, z = -300 + rand() * 520;
    if (nearest(track, x, z).distance < clearance) continue;
    out.push({ x, z, r: rand() * Math.PI * 2, s: 0.8 + rand() * 0.7 });
  }
  return out;
}

/** Asphalt, red-and-white kerbs, grass, start line, trees and a few campus-style buildings. */
export function TrackScene({ track }: { track: Track }) {
  const half = TRACK_WIDTH / 2;
  const road = useMemo(() => {
    const g = ribbon(track, -half, half, 1);
    return g;
  }, [track, half]);
  const kerbs = useMemo(() => {
    const colors: [THREE.Color, THREE.Color] = [new THREE.Color("#c8102e"), new THREE.Color("#f4f4f4")];
    return [ribbon(track, half, half + 1.2, 1, colors), ribbon(track, half, half + 1.2, -1, colors)];
  }, [track, half]);
  const trees = useMemo(() => scatter(track, 160, half + 9, 7), [track, half]);
  const buildings = useMemo(() => scatter(track, 9, half + 26, 99), [track, half]);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    trees.forEach((t, i) => {
      o.position.set(t.x, 1.2 * t.s, t.z); o.scale.setScalar(t.s); o.rotation.set(0, t.r, 0); o.updateMatrix();
      trunks.current?.setMatrixAt(i, o.matrix);
      o.position.set(t.x, 4 * t.s, t.z); o.updateMatrix();
      crowns.current?.setMatrixAt(i, o.matrix);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  const start = track.points[0], next = track.points[1];
  const startAngle = Math.atan2(next.x - start.x, next.z - start.z);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[80, 0, -40]}>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color="#5b8a46" roughness={1} />
      </mesh>
      <mesh geometry={road}><meshStandardMaterial color="#3a3d42" roughness={0.95} side={THREE.DoubleSide} /></mesh>
      {kerbs.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0.005, 0]}><meshStandardMaterial vertexColors roughness={0.8} side={THREE.DoubleSide} /></mesh>
      ))}
      {/* chequered start line */}
      <group position={[start.x, 0.02, start.z]} rotation={[0, startAngle, 0]}>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-half + 0.5 + i, 0, (i % 2) * 1 - 0.5]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={i % 2 ? "#111111" : "#ffffff"} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[0.25, 0.35, 2.4, 6]} />
        <meshStandardMaterial color="#6b4a2f" />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]}>
        <coneGeometry args={[2.2, 5, 7]} />
        <meshStandardMaterial color="#2f6b3a" flatShading />
      </instancedMesh>
      {/* grey-stone campus buildings with darker roofs */}
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation={[0, b.r, 0]}>
          <mesh position={[0, 6 * b.s, 0]}><boxGeometry args={[22 * b.s, 12 * b.s, 12]} /><meshStandardMaterial color="#b8b1a3" roughness={0.9} /></mesh>
          <mesh position={[0, 12.6 * b.s, 0]}><boxGeometry args={[23 * b.s, 1.2, 13]} /><meshStandardMaterial color="#5a6b70" /></mesh>
        </group>
      ))}
    </group>
  );
}
