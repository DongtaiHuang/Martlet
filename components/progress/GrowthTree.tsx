import type { CSSProperties } from "react";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { BLOOM_LEVELS, SPECIES_INFO, TREE_STAGES, type BloomLevel, type TreeSpecies, type TreeStage } from "@/lib/progress";
import { CLOUD_LAYERS, GRID_H, GRID_W, SKY_PATHS, pixelScene, treeColors, type PixelPalette, type PixelPath } from "./pixel-tree";

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
  /** Chosen species (ADR 0030). */
  species?: TreeSpecies;
  /** Level after full bloom (0-3); ignored before full bloom. */
  bloom?: BloomLevel;
}

const NO_FRUIT: TreeFruit[] = [];

export function GrowthTree({ stage, unlocked, total, preview = false, palette = "color", fruits = NO_FRUIT, species = "classic", bloom = 0 }: GrowthTreeProps) {
  const scene = pixelScene(stage, fruits.length, species, bloom);
  const colors = treeColors(palette, species);
  const name = `${SPECIES_INFO[species].label} ${stage === 6 ? BLOOM_LEVELS[bloom] : TREE_STAGES[stage]}`.toLowerCase();
  const paths = (list: PixelPath[]) => list.map((p) => <path key={p.color} d={p.d} fill={colors[p.color]} />);
  const shownFruit = scene.fruitSpots.map((spot, i) => ({ spot, fruit: fruits[i] }));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${GRID_W} ${GRID_H}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={preview
          ? `Preview: ${name}`
          : `Your tree: ${name} (${unlocked} of ${total} landmarks unlocked)`}
        className="martlet-tree block h-auto w-full overflow-hidden rounded-xl"
      >
        {paths(SKY_PATHS)}
        <rect className="martlet-sky-light" width={GRID_W} height={GRID_H} fill={colors.sky4} />
        {CLOUD_LAYERS.map((clouds, index) => (
          <g key={index} className={`martlet-clouds ${index === 0 ? "martlet-clouds-distant" : ""}`}>
            {paths(clouds)}
            <g transform={`translate(${-GRID_W} 0)`}>{paths(clouds)}</g>
          </g>
        ))}
        {paths(scene.landscape)}
        <path
          className="martlet-breeze"
          fill={colors.cloud}
          d="M0 47h8v1H0z M9 46h9v1H9z M15 51h13v1H15z M29 50h5v1h-5z"
        />
        {paths(scene.wood)}
        <g className={stage >= 3 ? "martlet-tree-sway" : undefined}>
          {paths(scene.foliage)}
        </g>
        {paths(scene.fruit)}
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
            <span aria-hidden="true" className="absolute inset-0 rounded-full ring-2 ring-white/0 transition group-hover:bg-surface/25 group-hover:ring-white group-focus-visible:bg-surface/25 group-focus-visible:ring-white" />
            {/* Preview card. */}
            <span
              aria-hidden="true"
              className={`pointer-events-none invisible absolute top-full mt-2 w-40 overflow-hidden rounded-xl border border-line bg-surface text-left opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 sm:w-48 ${align}`}
            >
              {fruit.photoUrl ? (
                // Short-lived signed Supabase URL; next/image would need remote config.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fruit.photoUrl} alt="" loading="lazy" className="block aspect-[4/3] w-full bg-surface-muted object-cover" />
              ) : (
                <span className="flex aspect-[4/3] w-full items-center justify-center bg-surface-muted text-stone-400"><ImageOff size={22} /></span>
              )}
              <span className="block p-2">
                <span className="block text-sm font-bold text-ink-soft">{fruit.landmarkName}</span>
                {fruit.caption && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">{fruit.caption}</span>}
                <span className="mt-1 block text-xs font-semibold text-brand-ink">Open your photo →</span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
