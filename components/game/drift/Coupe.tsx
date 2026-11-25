"use client";

/** Paint options. Generic names: the car is an unbranded sports coupe (no maker's names or badges). */
export const PAINTS = [
  { name: "Electric blue", color: "#1f5fd1" },
  { name: "Sunburst yellow", color: "#f2c21b" },
  { name: "Martlet red", color: "#a3172a" },
  { name: "Frozen grey", color: "#8a9199" },
  { name: "Racing green", color: "#1e5a3c" },
  { name: "Midnight black", color: "#17191c" },
] as const;
export type Paint = (typeof PAINTS)[number];

const BLACK = "#141414";
const GLASS = "#1d2a36";
const CHROME = "#c9ccd1";

function Wheel({ x, z, index }: { x: number; z: number; index: number }) {
  return (
    <group position={[x, 0.36, z]} name={`wheel-${index}`}>
      <group>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.36, 0.36, 0.3, 20]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[x > 0 ? 0.16 : -0.16, 0, 0]}>
          <cylinderGeometry args={[0.23, 0.23, 0.02, 10]} />
          <meshStandardMaterial color={CHROME} metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A low-poly sports coupe with M4-like proportions: long hood, short deck, wide arches, a dark
 * roof, front splitter, rear diffuser and quad exhausts. Deliberately unbranded: no badge, no
 * kidney grille, no maker's lights. Faces +z; wheels are named wheel-0…3 (front two first).
 */
export function Coupe({ paint }: { paint: Paint }) {
  const body = <meshStandardMaterial color={paint.color} metalness={0.45} roughness={0.35} />;
  return (
    <group>
      {/* soft shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[2.4, 5.2]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      {/* lower body and wide arches */}
      <mesh position={[0, 0.5, 0]}><boxGeometry args={[1.86, 0.52, 4.6]} />{body}</mesh>
      <mesh position={[0, 0.52, 1.4]}><boxGeometry args={[2.0, 0.42, 1.15]} />{body}</mesh>
      <mesh position={[0, 0.54, -1.4]}><boxGeometry args={[2.08, 0.46, 1.25]} />{body}</mesh>
      {/* long hood with a power bulge */}
      <mesh position={[0, 0.79, 1.3]}><boxGeometry args={[1.7, 0.1, 1.75]} />{body}</mesh>
      <mesh position={[0, 0.85, 1.25]}><boxGeometry args={[0.7, 0.05, 1.3]} />{body}</mesh>
      {/* cabin: glasshouse and a dark roof */}
      <mesh position={[0, 1.02, -0.35]}><boxGeometry args={[1.56, 0.46, 1.95]} /><meshStandardMaterial color={GLASS} metalness={0.3} roughness={0.15} /></mesh>
      <mesh position={[0, 1.27, -0.45]}><boxGeometry args={[1.46, 0.06, 1.45]} /><meshStandardMaterial color={BLACK} roughness={0.5} /></mesh>
      {/* boot with a small lip spoiler */}
      <mesh position={[0, 0.82, -1.85]}><boxGeometry args={[1.66, 0.12, 0.85]} />{body}</mesh>
      <mesh position={[0, 0.9, -2.25]}><boxGeometry args={[1.6, 0.05, 0.18]} /><meshStandardMaterial color={BLACK} /></mesh>
      {/* front: splitter, a plain lower intake, headlights */}
      <mesh position={[0, 0.24, 2.32]}><boxGeometry args={[1.84, 0.06, 0.28]} /><meshStandardMaterial color={BLACK} /></mesh>
      <mesh position={[0, 0.42, 2.31]}><boxGeometry args={[1.2, 0.16, 0.04]} /><meshStandardMaterial color={BLACK} /></mesh>
      {[-0.62, 0.62].map((x) => (
        <mesh key={x} position={[x, 0.66, 2.31]}><boxGeometry args={[0.46, 0.1, 0.04]} /><meshStandardMaterial color="#ffffff" emissive="#fff6d5" emissiveIntensity={1.2} /></mesh>
      ))}
      {/* rear: tail lights, diffuser, quad exhausts */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.72, -2.31]}><boxGeometry args={[0.52, 0.1, 0.04]} /><meshStandardMaterial color="#b3121b" emissive="#ff1a1a" emissiveIntensity={0.9} /></mesh>
      ))}
      <mesh position={[0, 0.26, -2.28]}><boxGeometry args={[1.6, 0.18, 0.2]} /><meshStandardMaterial color={BLACK} /></mesh>
      {[-0.56, -0.36, 0.36, 0.56].map((x) => (
        <mesh key={x} position={[x, 0.27, -2.4]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.055, 0.055, 0.14, 10]} /><meshStandardMaterial color={CHROME} metalness={0.9} roughness={0.25} /></mesh>
      ))}
      {/* mirrors */}
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} position={[x, 0.98, 0.45]}><boxGeometry args={[0.16, 0.1, 0.18]} />{body}</mesh>
      ))}
      <Wheel x={-0.92} z={1.42} index={0} />
      <Wheel x={0.92} z={1.42} index={1} />
      <Wheel x={-0.95} z={-1.42} index={2} />
      <Wheel x={0.95} z={-1.42} index={3} />
    </group>
  );
}
