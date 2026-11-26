// Shared pixel-art helpers (ADR 0044). A sprite is a grid of colour letters ("." is empty),
// turned into one path per colour made of 1x1 row runs: drawn as crisp SVG (shape-rendering
// crispEdges) or onto a canvas with image smoothing off. Pure and deterministic, so server and
// browser agree and node --test can import it.

export type Grid = string[][];
export type Sprite = { w: number; h: number; paths: { fill: string; d: string }[] };
export type Palette = Record<string, string>;

/** Rows of letters ("..KK..") to a grid. Rows may differ in length; short ones are padded. */
export function grid(rows: readonly string[]): Grid {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r.padEnd(w, ".")]);
}

export function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array(w).fill("."));
}

/** Outline every empty cell that touches a filled one (4-neighbours) with `outline`. */
export function outlined(g: Grid, outline: string): Grid {
  const out = g.map((row) => [...row]);
  g.forEach((row, y) => row.forEach((c, x) => {
    if (c !== ".") return;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = g[y + dy]?.[x + dx]; return n !== undefined && n !== "." && n !== outline; })) out[y][x] = outline;
  }));
  return out;
}

/** Paints `top` over `base` at (dx, dy); "." in `top` leaves `base` showing. */
export function overlay(base: Grid, top: Grid, dx = 0, dy = 0): Grid {
  const out = base.map((row) => [...row]);
  top.forEach((row, y) => row.forEach((c, x) => {
    if (c !== "." && out[y + dy]?.[x + dx] !== undefined) out[y + dy][x + dx] = c;
  }));
  return out;
}

/** Mirrors a grid left-right. */
export const mirrored = (g: Grid): Grid => g.map((row) => [...row].reverse());

/** One path per colour, in palette order (later colours paint over earlier ones). */
export function toSprite(g: Grid, colors: Palette): Sprite {
  const runs: Record<string, string[]> = {};
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      if (c !== "." && colors[c]) (runs[c] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return { w: g[0]?.length ?? 0, h: g.length, paths: Object.keys(colors).filter((c) => runs[c]).map((c) => ({ fill: colors[c], d: runs[c].join("") })) };
}

/** Shorthand: rows straight to a sprite. */
export const sprite = (rows: readonly string[], colors: Palette, outline?: string): Sprite =>
  toSprite(outline ? outlined(grid(rows), outline) : grid(rows), colors);

/** A standalone SVG string, e.g. for a data: URL or an HTML marker. */
export function spriteSvg(s: Sprite, size?: { width: number; height: number }): string {
  const body = s.paths.map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join("");
  const dims = size ? ` width="${size.width}" height="${size.height}"` : ` width="${s.w}" height="${s.h}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.w} ${s.h}"${dims} shape-rendering="crispEdges">${body}</svg>`;
}

// Canvas drawing: Path2D objects are built once per sprite and reused every frame.
const pathCache = new WeakMap<Sprite, Path2D[]>();

/** Draws a sprite at integer pixel (x, y) on a canvas whose 1 unit is 1 art pixel. */
export function drawSprite(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number) {
  let paths = pathCache.get(s);
  if (!paths) { paths = s.paths.map((p) => new Path2D(p.d)); pathCache.set(s, paths); }
  g.save();
  g.translate(Math.round(x), Math.round(y));
  s.paths.forEach((p, i) => { g.fillStyle = p.fill; g.fill(paths[i]); });
  g.restore();
}
