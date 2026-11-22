import { NEST_H, NEST_W, nestPaths } from "./nest-pixels";

/**
 * One layer of Marty's nest at the bottom-left end of the lane. Render "back" before the bird
 * and "front" after it, so Marty sits inside. Sized in Marty's pixel grid (--martlet-px).
 */
export function MartletNest({ layer }: { layer: "back" | "front" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${NEST_W} ${NEST_H}`}
      shapeRendering="crispEdges"
      className="martlet-nest pointer-events-none absolute"
    >
      {nestPaths(layer).map((p) => <path key={p.fill} fill={p.fill} d={p.d} />)}
    </svg>
  );
}

// A 6x6 pixel "Z" with a 2-pixel diagonal and a dark outline (the Z stamped one pixel in
// each direction), so it reads on light and dark pages.
const Z = "M1 1h6v1h-6zM5 2h2v1h-2zM4 3h2v1h-2zM3 4h2v1h-2zM2 5h2v1h-2zM1 6h6v1h-6z";
const OUTLINE = ["-1 0", "1 0", "0 -1", "0 1"];

/** Three Zs drifting up from sleeping Marty's head, fading as they go. */
export function MartletZzz() {
  return (
    <span aria-hidden="true" className="martlet-zzz-anchor pointer-events-none absolute">
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 8 8" shapeRendering="crispEdges" className="martlet-zzz absolute" style={{ animationDelay: `${i * 2}s` }}>
          {OUTLINE.map((shift) => <path key={shift} fill="#39131d" d={Z} transform={`translate(${shift})`} />)}
          <path fill="#fff3e1" d={Z} />
        </svg>
      ))}
    </span>
  );
}
