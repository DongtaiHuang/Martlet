import type { CSSProperties } from "react";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { TREE_STAGES, type TreeStage } from "@/lib/progress";
import { GRID_H, GRID_W, PALETTES, pixelScene, type PixelPalette, type PixelPath } from "./pixel-tree";

// Pixel-art progress tree: a tiny seedling alone in a wide open field that grows (7 stages)
// into a tree filling the sky. Each of the user's landmark photos hangs on it as a fruit:
// hover or focus shows a preview card, click opens that photo on its landmark page.
// The scene is generated in ./pixel-tree.ts; motion is CSS (app/globals.css) and stops for
// reduced motion. Server-rendered; the preview card is CSS-only, so no client JavaScript.

export interface TreeFruit {
  landmarkId: string;
  landmarkName: string;
  caption: string;
  photoUrl: string | null;
  href: string;
}

interface GrowthTreeProps {
  stage: TreeStage;
  unlocked: number;
  total: number;
  /** True when showing a stage other than the user's real one. */
  preview?: boolean;
  palette?: PixelPalette;
  /** The user's photos, in unlock order; each becomes one fruit. */
  fruits?: TreeFruit[];
}

const NO_FRUIT: TreeFruit[] = [];

export function GrowthTree({ stage, unlocked, total, preview = false, palette = "color", fruits = NO_FRUIT }: GrowthTreeProps) {
  const scene = pixelScene(stage, fruits.length);
  const colors = PALETTES[palette];
  const paths = (list: PixelPath[]) => list.map((p) => <path key={p.color} d={p.d} fill={colors[p.color]} />);
  const shownFruit = scene.fruitSpots.map((spot, i) => ({ spot, fruit: fruits[i] }));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${GRID_W} ${GRID_H}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={preview
          ? `Preview of the ${TREE_STAGES[stage]} stage`
          : `Your tree: ${TREE_STAGES[stage]} (${unlocked} of ${total} landmarks unlocked)`}
        className="martlet-tree block h-auto w-full rounded-xl"
      >
        {paths(scene.background)}
        {paths(scene.wood)}
        <g className={stage >= 3 ? "martlet-tree-sway" : undefined}>
          {paths(scene.foliage)}
          {paths(scene.fruit)}
        </g>
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

      {/* One link per fruit, positioned over it, with a larger hit area than the 2-pixel fruit. */}
      {shownFruit.map(({ spot, fruit }) => {
        const left = ((spot.x + spot.size / 2) / GRID_W) * 100;
        const top = ((spot.y + spot.size / 2) / GRID_H) * 100;
        const align = left < 30 ? "left-0" : left > 70 ? "right-0" : "left-1/2 -translate-x-1/2";
        return (
          <Link
            key={fruit.landmarkId}
            href={fruit.href}
            aria-label={`Your photo at ${fruit.landmarkName}`}
            data-achievement="fruit-inspector"
            className="group absolute z-10 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full hover:z-20 focus-visible:z-20 focus-visible:outline-none sm:size-8"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {/* Hover/focus indicator around the fruit. */}
            <span aria-hidden="true" className="absolute inset-0 rounded-full ring-2 ring-white/0 transition group-hover:bg-white/25 group-hover:ring-white group-focus-visible:bg-white/25 group-focus-visible:ring-white" />
            {/* Preview card. */}
            <span
              aria-hidden="true"
              className={`pointer-events-none invisible absolute top-full mt-2 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white text-left opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 sm:w-48 ${align}`}
            >
              {fruit.photoUrl ? (
                // Short-lived signed Supabase URL; next/image would need remote config.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fruit.photoUrl} alt="" loading="lazy" className="block aspect-[4/3] w-full bg-stone-100 object-cover" />
              ) : (
                <span className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-stone-400"><ImageOff size={22} /></span>
              )}
              <span className="block p-2">
                <span className="block text-sm font-bold text-stone-900">{fruit.landmarkName}</span>
                {fruit.caption && <span className="mt-0.5 line-clamp-2 block text-xs text-stone-600">{fruit.caption}</span>}
                <span className="mt-1 block text-xs font-semibold text-red-800">Open your photo →</span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
