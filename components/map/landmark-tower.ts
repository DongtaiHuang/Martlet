// Pixel-art tower pins for landmarks (server-safe: plain strings, no DOM).
// Inspired by a brick clock-tower: red brick, cream stone trim, blue windows, a pink
// spire. The tower grows taller and grander as more photos are shared at the landmark.
// Undiscovered landmarks are drawn in greyscale.

export const TOWER_TIERS = [
  // min photos, body width, body height, crenels, spire height, flag, turret width, turret height
  { min: 0, w: 5, h: 4, crenels: true, spire: 0, flag: false, tw: 0, th: 0 },
  { min: 1, w: 5, h: 7, crenels: false, spire: 4, flag: false, tw: 0, th: 0 },
  { min: 3, w: 7, h: 10, crenels: true, spire: 5, flag: false, tw: 0, th: 0 },
  { min: 6, w: 7, h: 13, crenels: true, spire: 6, flag: true, tw: 0, th: 0 },
  { min: 11, w: 9, h: 15, crenels: true, spire: 7, flag: true, tw: 3, th: 7 },
  { min: 25, w: 9, h: 18, crenels: true, spire: 9, flag: true, tw: 3, th: 11 },
] as const;

/** Tier index (0..5) for a landmark with `photos` shared photos. */
export function towerTier(photos: number): number {
  let tier = 0;
  TOWER_TIERS.forEach((t, i) => { if (photos >= t.min) tier = i; });
  return tier;
}

const COLOR: Record<string, string> = {
  K: "#2a1d1a", // outline
  R: "#b5473a", // brick
  D: "#8e3328", // brick shade
  C: "#f1dfc0", // cream stone
  W: "#5f70ab", // window
  B: "#4a2a20", // door
  P: "#e2606a", // spire
  Q: "#9c2c38", // spire shade
  Y: "#f5c84c", // flag
};
const GREY: Record<string, string> = {
  K: "#3f3f46", R: "#a1a1aa", D: "#7c7c85", C: "#e4e4e7", W: "#71717a",
  B: "#52525b", P: "#b4b4bb", Q: "#8b8b93", Y: "#d4d4d8",
};

type Grid = string[][];

function towerGrid(tier: number): Grid {
  const t = TOWER_TIERS[tier];
  const width = t.w + 2 * t.tw + 4; // 2 cells of padding each side for the outline/plinth
  const top = t.spire + (t.flag ? 3 : 0) + (t.crenels ? 1 : 0);
  const height = top + t.h + 3; // plinth + bottom outline + top outline
  const g: Grid = Array.from({ length: height }, () => Array(width).fill("."));
  const set = (x: number, y: number, c: string) => { if (g[y]?.[x] !== undefined) g[y][x] = c; };
  const cx = Math.floor(width / 2);
  const bx = cx - (t.w - 1) / 2; // body left x
  const groundY = height - 2; // plinth row
  const bodyTop = groundY - t.h;

  // Side turrets, behind the body.
  if (t.tw) {
    for (const side of [-1, 1]) {
      const tx = side < 0 ? bx - t.tw : bx + t.w;
      for (let y = groundY - t.th; y < groundY; y++)
        for (let x = tx; x < tx + t.tw; x++) set(x, y, x === tx + t.tw - 1 ? "D" : "R");
      for (let x = tx; x < tx + t.tw; x++) set(x, groundY - t.th, "C");
      set(tx + 1, groundY - t.th + 3, "W");
      set(tx + 1, groundY - t.th + 4, "W");
      // tiny pointed roof
      set(tx + 1, groundY - t.th - 1, "P");
      if (tier >= 5) set(tx + 1, groundY - t.th - 2, "P");
    }
  }

  // Body: brick with a shaded right edge, cream bands and windows.
  for (let y = bodyTop; y < groundY; y++)
    for (let x = bx; x < bx + t.w; x++) set(x, y, x === bx + t.w - 1 ? "D" : "R");
  for (let x = bx; x < bx + t.w; x++) set(x, bodyTop, "C");
  for (let y = bodyTop + 5; y < groundY - 2; y += 5)
    for (let x = bx; x < bx + t.w; x++) set(x, y, "C");
  const cols = t.w >= 9 ? [cx - 2, cx + 2] : t.w >= 7 ? [cx - 2, cx, cx + 2] : [cx];
  for (let y = bodyTop + 2; y < groundY - 3; y += 5)
    for (const x of t.w >= 9 ? [...cols, cx] : cols) { set(x, y, "W"); set(x, y + 1, "W"); }
  // door
  set(cx, groundY - 1, "B");
  set(cx, groundY - 2, "B");
  if (t.w >= 9) { set(cx - 1, groundY - 1, "B"); set(cx + 1, groundY - 1, "B"); }

  // Plinth.
  for (let x = bx - 1 - t.tw; x <= bx + t.w + t.tw; x++) set(x, groundY, "C");

  // Crenels on top of the body.
  let roofBase = bodyTop - 1;
  if (t.crenels) {
    for (let x = bx; x < bx + t.w; x += 2) set(x, bodyTop - 1, "C");
    roofBase = bodyTop - 1;
  }

  // Spire: a triangle with a lit left half and a shaded right half.
  if (t.spire) {
    const half = (t.crenels ? t.w - 2 : t.w) - 1;
    const tipY = roofBase - t.spire + (t.crenels ? 0 : 1);
    for (let i = 0; i < t.spire; i++) {
      const hw = Math.round((i * (half / 2)) / Math.max(1, t.spire - 1));
      for (let x = cx - hw; x <= cx + hw; x++) set(x, tipY + i, x <= cx ? "P" : "Q");
    }
    if (t.flag) {
      for (let y = tipY - 3; y < tipY; y++) set(cx, y, "K");
      set(cx + 1, tipY - 3, "Y"); set(cx + 2, tipY - 3, "Y"); set(cx + 1, tipY - 2, "Y");
    }
  }

  // Outline every empty cell that touches a coloured cell (the flag pole is already K).
  const out = g.map((row) => [...row]);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (g[y][x] !== ".") continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const c = g[y + dy]?.[x + dx];
        return c !== undefined && c !== "." && c !== "K";
      });
      if (near) out[y][x] = "K";
    }
  return out;
}

const cache = new Map<number, Grid>();
function grid(tier: number): Grid {
  let g = cache.get(tier);
  if (!g) { g = towerGrid(tier); cache.set(tier, g); }
  return g;
}

/** Grid size of a tier's tower, in cells. */
export function towerCells(tier: number) {
  const g = grid(tier);
  return { w: g[0].length, h: g.length };
}

/**
 * SVG markup for a tower. `cell` is the on-screen size of one pixel; pass `height` instead
 * to fit a fixed height (e.g. list badges). Output uses only constant colours and numbers.
 */
export function towerSvg(tier: number, discovered: boolean, opts: { cell?: number; height?: number } = {}) {
  const g = grid(tier);
  const fills = discovered ? COLOR : GREY;
  const runs: Record<string, string[]> = {};
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      if (c !== ".") (runs[c] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  const w = g[0].length, h = g.length;
  const px = opts.height ? opts.height / h : opts.cell ?? 2;
  const paths = Object.entries(runs).map(([c, d]) => `<path d="${d.join("")}" fill="${fills[c]}"/>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${Math.round(w * px)}" height="${Math.round(h * px)}" shape-rendering="crispEdges" aria-hidden="true">${paths}</svg>`;
}
