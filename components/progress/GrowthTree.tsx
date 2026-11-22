import type { CSSProperties } from "react";
import { TREE_STAGES, type TreeStage } from "@/lib/progress";
import { GRID_H, GRID_W, PALETTES, pixelScene, type PixelPalette, type PixelPath } from "./pixel-tree";

// Pixel-art progress tree: a tiny seedling alone in a wide open field that grows (7 stages)
// into a tree filling the sky. The scene is generated in ./pixel-tree.ts; `palette` picks
// colour (default) or black and white. Leaves shift a pixel back and forth and fall in steps
// (CSS in app/globals.css); both stop for reduced motion. No client JavaScript.

interface GrowthTreeProps {
  stage: TreeStage;
  unlocked: number;
  total: number;
  /** True when showing a stage other than the user's real one. */
  preview?: boolean;
  palette?: PixelPalette;
}

export function GrowthTree({ stage, unlocked, total, preview = false, palette = "color" }: GrowthTreeProps) {
  const scene = pixelScene(stage);
  const colors = PALETTES[palette];
  const paths = (list: PixelPath[]) => list.map((p) => <path key={p.color} d={p.d} fill={colors[p.color]} />);

  return (
    <svg
      viewBox={`0 0 ${GRID_W} ${GRID_H}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={preview
        ? `Preview of the ${TREE_STAGES[stage]} stage`
        : `Your tree: ${TREE_STAGES[stage]} (${unlocked} of ${total} landmarks unlocked)`}
      className="martlet-tree block h-auto w-full"
    >
      {paths(scene.background)}
      {paths(scene.wood)}
      <g className={stage >= 3 ? "martlet-tree-sway" : undefined}>{paths(scene.foliage)}</g>
      {scene.falling.map((leaf) => (
        <rect
          key={`${leaf.x}-${leaf.y}-${leaf.delay}`}
          className="martlet-falling-leaf"
          x={leaf.x}
          y={leaf.y}
          width="1"
          height="1"
          fill={colors[leaf.color]}
          style={{ "--drift": `${leaf.drift}px`, "--fall": `${leaf.fall}px`, animationDelay: `${leaf.delay}s` } as CSSProperties}
        />
      ))}
      {scene.bird && <g className="martlet-bird">{paths(scene.bird)}</g>}
    </svg>
  );
}
