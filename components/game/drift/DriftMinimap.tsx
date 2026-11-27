import { useMemo } from "react";
import type { Track } from "@/lib/drift";
import type { NamedOutline } from "@/lib/drift-hud";

/**
 * A north-up map of the loop for Martlet Drift's HUD (ADR 0047): the track, McGill's buildings in
 * red and your car as an arrow. World axes are x east and z south, so they map straight to SVG.
 */
type Pose = { x: number; z: number; heading: number };

export function DriftMinimap({ track, buildings, car, ghost = null, rivals = [] }: {
  track: Track; buildings: readonly NamedOutline[]; car: Pose; ghost?: Pose | null; rivals?: (Pose & { color: string })[];
}) {
  const view = useMemo(() => {
    const xs = track.points.map((p) => p.x), zs = track.points.map((p) => p.z);
    const pad = 40;
    const minX = Math.min(...xs) - pad, minZ = Math.min(...zs) - pad;
    const size = Math.max(Math.max(...xs) - minX, Math.max(...zs) - minZ) + pad;
    const road = `M${track.points.map((p) => `${p.x.toFixed(1)} ${p.z.toFixed(1)}`).join("L")}Z`;
    return { box: `${minX.toFixed(0)} ${minZ.toFixed(0)} ${size.toFixed(0)} ${size.toFixed(0)}`, road, unit: size / 100 };
  }, [track]);
  const outlines = useMemo(() => buildings.map((b) => b.points.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join(" ")), [buildings]);
  const u = view.unit;
  const start = track.points[0];

  return (
    <svg viewBox={view.box} shapeRendering="crispEdges" className="size-full" aria-hidden="true">
      <rect x="-100000" y="-100000" width="200000" height="200000" fill="#1d2b22" opacity="0.7" />
      {outlines.map((pts, i) => <polygon key={i} points={pts} fill="#a6192e" opacity="0.85" />)}
      <path d={view.road} fill="none" stroke="#2a2a30" strokeWidth={u * 6} strokeLinejoin="round" />
      <path d={view.road} fill="none" stroke="#d9d4cc" strokeWidth={u * 3.5} strokeLinejoin="round" />
      <rect x={start.x - u * 2.5} y={start.z - u * 2.5} width={u * 5} height={u * 5} fill="#ffffff" stroke="#111" strokeWidth={u} />
      {ghost && (
        <g transform={`translate(${ghost.x.toFixed(1)} ${ghost.z.toFixed(1)}) rotate(${(180 - (ghost.heading * 180) / Math.PI).toFixed(1)})`} opacity="0.75">
          <path d={`M0 ${-u * 6}L${u * 4} ${u * 4}L0 ${u * 1.5}L${-u * 4} ${u * 4}Z`} fill="#c8c8d0" stroke="#111" strokeWidth={u * 1.2} strokeLinejoin="round" />
        </g>
      )}
      {rivals.map((r, i) => (
        <g key={i} transform={`translate(${r.x.toFixed(1)} ${r.z.toFixed(1)}) rotate(${(180 - (r.heading * 180) / Math.PI).toFixed(1)})`}>
          <path d={`M0 ${-u * 6}L${u * 4} ${u * 4}L0 ${u * 1.5}L${-u * 4} ${u * 4}Z`} fill={r.color} stroke="#111" strokeWidth={u * 1.2} strokeLinejoin="round" />
        </g>
      ))}
      {/* The car: an arrow pointing where it's heading (heading 0 faces +z, i.e. down). */}
      <g transform={`translate(${car.x.toFixed(1)} ${car.z.toFixed(1)}) rotate(${(180 - (car.heading * 180) / Math.PI).toFixed(1)})`}>
        <path d={`M0 ${-u * 6}L${u * 4} ${u * 4}L0 ${u * 1.5}L${-u * 4} ${u * 4}Z`} fill="#f5c84c" stroke="#111" strokeWidth={u * 1.2} strokeLinejoin="round" />
      </g>
    </svg>
  );
}
