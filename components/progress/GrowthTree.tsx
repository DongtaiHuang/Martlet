import type { CSSProperties } from "react";
import { TREE_STAGES, type TreeStage } from "@/lib/progress";

// One tree design drawn at 7 growth stages (seed -> full bloom). Every stage shares the
// same palette, ground, leaf shape, trunk and canopy circles, so it reads as one tree
// growing. Sway and falling leaves are CSS-only (app/globals.css) and turn off when the
// user prefers reduced motion. Server-renderable: no client JavaScript.

const C = {
  sky: "#f4efe3",
  grass: "#9cc47c",
  grassDark: "#7fae62",
  soil: "#8a5a36",
  bark: "#7a4b2a",
  barkDark: "#5f3a20",
  leafDark: "#2f6b3a",
  leaf: "#3f8a46",
  leafLight: "#5aa952",
  highlight: "#7cc46e",
  blossom: "#c8102e", // McGill red
  seed: "#6b4226",
};

const BASE_X = 120;
const BASE_Y = 230;

/** Same leaf silhouette everywhere: sprout, sapling, falling leaves. */
const LEAF = "M0 0 C5 -6 13 -7 18 0 C13 7 5 6 0 0 Z";

function Leaf({ x, y, angle, scale = 1, fill = C.leafLight }: { x: number; y: number; angle: number; scale?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
      <path d={LEAF} fill={fill} />
      <path d="M1 0 L16 0" stroke={C.leaf} strokeWidth="0.8" strokeLinecap="round" />
    </g>
  );
}

// Full-size tree parts, revealed progressively and scaled by stage.
const TRUNK = "M106 230 C112 204 113 178 114 140 L126 140 C127 178 128 204 134 230 Z";
const ROOTS = "M100 231 C106 226 110 224 112 220 L118 230 Z M140 231 C134 226 130 224 128 220 L122 230 Z";
const BRANCHES = [
  { d: "M116 172 C104 162 96 152 84 140", w: 6 },
  { d: "M124 162 C136 152 146 142 158 130", w: 6 },
  { d: "M118 150 C110 136 104 122 99 108", w: 4 },
  { d: "M122 146 C132 132 138 118 142 104", w: 4 },
];
// Back-to-front: darker clusters first for depth.
const CANOPY = [
  { cx: 120, cy: 106, r: 34, fill: C.leafDark },
  { cx: 92, cy: 126, r: 26, fill: C.leaf },
  { cx: 148, cy: 123, r: 27, fill: C.leaf },
  { cx: 100, cy: 92, r: 24, fill: C.leafLight },
  { cx: 142, cy: 90, r: 24, fill: C.leafLight },
  { cx: 74, cy: 142, r: 18, fill: C.leaf },
  { cx: 166, cy: 140, r: 18, fill: C.leaf },
  { cx: 120, cy: 72, r: 22, fill: C.leafLight },
  { cx: 120, cy: 132, r: 24, fill: C.leafLight },
];
const BLOSSOMS = [
  [96, 84], [138, 78], [120, 62], [80, 132], [160, 128], [108, 118], [142, 110], [126, 96], [92, 104], [150, 98],
];

// Stage 3..6: overall scale, clusters shown, branches shown.
const TREE_GROWTH: Record<3 | 4 | 5 | 6, { scale: number; clusters: number; branches: number }> = {
  3: { scale: 0.55, clusters: 3, branches: 2 },
  4: { scale: 0.7, clusters: 5, branches: 4 },
  5: { scale: 0.86, clusters: 7, branches: 4 },
  6: { scale: 1, clusters: 9, branches: 4 },
};

// Falling leaves (and petals at full bloom): start inside the canopy, drift down to the ground.
const FALLING = [
  { x: 96, y: 118, drift: -22, delay: 0 },
  { x: 140, y: 108, drift: 18, delay: 2.3 },
  { x: 118, y: 92, drift: -10, delay: 4.1 },
  { x: 154, y: 132, drift: 26, delay: 5.6 },
  { x: 84, y: 138, drift: -16, delay: 1.2 },
];

function scaleAtBase(scale: number) {
  return `translate(${BASE_X} ${BASE_Y}) scale(${scale}) translate(${-BASE_X} ${-BASE_Y})`;
}

function Martlet() {
  // McGill's martlet as a simple bird silhouette, perched in the sky at full bloom.
  return (
    <g className="martlet-bird" transform="translate(190 52)">
      <path d="M-13 0 Q-7 -7 0 -1 Q7 -7 13 0 Q7 -3 0 3 Q-7 -3 -13 0 Z" fill={C.blossom} />
    </g>
  );
}

function SmallPlant({ stage }: { stage: 1 | 2 }) {
  if (stage === 1) {
    return (
      <g>
        <path d="M120 228 C120 218 118 210 121 200" stroke={C.leaf} strokeWidth="3" fill="none" strokeLinecap="round" />
        <Leaf x={121} y={201} angle={-150} scale={0.8} />
        <Leaf x={121} y={201} angle={-30} scale={0.8} />
      </g>
    );
  }
  return (
    <g>
      <path d="M120 228 C119 210 122 192 120 168" stroke={C.bark} strokeWidth="4" fill="none" strokeLinecap="round" />
      <Leaf x={120} y={206} angle={-160} scale={0.9} fill={C.leaf} />
      <Leaf x={121} y={192} angle={-20} scale={0.95} />
      <Leaf x={120} y={180} angle={-155} scale={0.9} />
      <Leaf x={120} y={169} angle={-35} scale={1} />
      <Leaf x={120} y={168} angle={-110} scale={0.8} fill={C.leaf} />
    </g>
  );
}

function Tree({ stage }: { stage: 3 | 4 | 5 | 6 }) {
  const { clusters, branches } = TREE_GROWTH[stage];
  return (
    <g>
      <path d={ROOTS} fill={C.barkDark} />
      <path d={TRUNK} fill={C.bark} />
      <path d="M118 225 C119 200 119 176 119 150" stroke={C.barkDark} strokeWidth="1.5" fill="none" opacity="0.5" />
      {BRANCHES.slice(0, branches).map((b) => (
        <path key={b.d} d={b.d} stroke={C.bark} strokeWidth={b.w} fill="none" strokeLinecap="round" />
      ))}
      {CANOPY.slice(0, clusters).map((c) => (
        <g key={`${c.cx}-${c.cy}`}>
          <circle cx={c.cx} cy={c.cy} r={c.r} fill={c.fill} />
          <circle cx={c.cx - c.r * 0.3} cy={c.cy - c.r * 0.32} r={c.r * 0.38} fill={C.highlight} opacity="0.35" />
        </g>
      ))}
      {stage === 6 && BLOSSOMS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="3.6" fill={C.blossom} />
          <circle cx={x} cy={y} r="1.3" fill="#fde68a" />
        </g>
      ))}
    </g>
  );
}

export function GrowthTree({ stage, unlocked, total }: { stage: TreeStage; unlocked: number; total: number }) {
  const isTree = stage >= 3;
  const scale = isTree ? TREE_GROWTH[stage as 3 | 4 | 5 | 6].scale : 1;
  const fallers = stage >= 6 ? FALLING : stage >= 4 ? FALLING.slice(0, 3) : stage === 3 ? FALLING.slice(0, 1) : [];

  return (
    <svg
      viewBox="0 0 240 260"
      role="img"
      aria-label={`Your tree: ${TREE_STAGES[stage]} (${unlocked} of ${total} landmarks unlocked)`}
      className="martlet-tree h-auto w-full"
    >
      <circle cx="120" cy="140" r="112" fill={C.sky} />
      {stage === 6 && <Martlet />}

      {/* Ground: same in every stage. The plant stands on the soil mound. */}
      <ellipse cx="120" cy="234" rx="96" ry="15" fill={C.grass} />
      <ellipse cx="120" cy="236" rx="70" ry="9" fill={C.grassDark} />
      <ellipse cx="120" cy="231" rx="26" ry="6" fill={C.soil} />

      <g transform={scaleAtBase(scale)}>
        <g className="martlet-tree-sway">
          {stage === 0 && (
            <g>
              <ellipse cx="120" cy="226" rx="9" ry="6" fill={C.seed} transform="rotate(-20 120 226)" />
              <path d="M123 221 C124 217 127 215 129 214" stroke={C.leafLight} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
          )}
          {(stage === 1 || stage === 2) && <SmallPlant stage={stage} />}
          {isTree && <Tree stage={stage as 3 | 4 | 5 | 6} />}
        </g>
        {fallers.map((f, i) => (
          <g key={f.delay} transform={`translate(${f.x} ${f.y})`}>
            <g
              className="martlet-falling-leaf"
              style={{ "--drift": `${f.drift}px`, "--fall": `${BASE_Y - f.y - 4}px`, animationDelay: `${f.delay}s` } as CSSProperties}
            >
              {stage === 6 && i % 2 === 1
                ? <circle r="3" fill={C.blossom} />
                : <path d={LEAF} fill={i % 2 ? C.leaf : C.leafLight} transform="scale(0.6)" />}
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}
