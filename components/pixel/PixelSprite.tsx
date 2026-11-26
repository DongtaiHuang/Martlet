import type { Sprite } from "@/lib/pixel/sprite";

/** Draws a pixel sprite as crisp SVG (ADR 0044). Decorative by default; give `label` to name it. */
export function PixelSprite({ sprite, className = "", label }: { sprite: Sprite; className?: string; label?: string }) {
  return (
    <svg viewBox={`0 0 ${sprite.w} ${sprite.h}`} shapeRendering="crispEdges" className={className}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}>
      {sprite.paths.map((p) => <path key={p.fill} fill={p.fill} d={p.d} />)}
    </svg>
  );
}
