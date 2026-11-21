import type { CSSProperties } from "react";
import { TREE_STAGES, type TreeStage } from "@/lib/progress";
import { GRID_H, GRID_W, PALETTE, pixelScene, type PixelPath } from "./pixel-tree";

// Black-and-white pixel-art progress tree: a tiny seedling alone in a wide open field that
// grows (7 stages) into a tree filling the sky. The scene is generated in ./pixel-tree.ts.
// Leaves shift a pixel back and forth and fall in steps (CSS in app/globals.css); both stop
// when the user prefers reduced motion. Server-renderable: no client JavaScript.

function Paths({ paths }: { paths: PixelPath[] }) {
  return paths.map((p) => <path key={p.color} d={p.d} fill={PALETTE[p.color]} />);
}

export function GrowthTree({ stage, unlocked, total }: { stage: TreeStage; unlocked: number; total: number }) {
  const scene = pixelScene(stage);

  return (
    <svg
      viewBox={`0 0 ${GRID_W} ${GRID_H}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Your tree: ${TREE_STAGES[stage]} (${unlocked} of ${total} landmarks unlocked)`}
      className="martlet-tree block h-auto w-full"
    >
      <Paths paths={scene.background} />
      <Paths paths={scene.wood} />
      <g className={stage >= 3 ? "martlet-tree-sway" : undefined}>
        <Paths paths={scene.foliage} />
      </g>
      {scene.falling.map((leaf) => (
        <rect
          key={`${leaf.x}-${leaf.y}-${leaf.delay}`}
          className="martlet-falling-leaf"
          x={leaf.x}
          y={leaf.y}
          width="1"
          height="1"
          fill={PALETTE[leaf.color]}
          style={{ "--drift": `${leaf.drift}px`, "--fall": `${leaf.fall}px`, animationDelay: `${leaf.delay}s` } as CSSProperties}
        />
      ))}
      {scene.bird && (
        <g className="martlet-bird">
          <Paths paths={scene.bird} />
        </g>
      )}
    </svg>
  );
}
