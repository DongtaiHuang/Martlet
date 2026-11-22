import type { TreeStage } from "@/lib/progress";

// Black-and-white pixel-art scene for the progress tree: one tree, centred in a wide open
// field under a big sky. Everything is painted on a coarse grid (1 unit = 1 "pixel") and
// shaded with ordered (Bayer) dithering, so the output is deterministic. The grid is then
// turned into one SVG path per colour (row runs), which keeps the markup small.

export const GRID_W = 120;
export const GRID_H = 60;
const HORIZON = 41;
const BASE_X = 60; // tree is centred
const BASE_Y = 47; // ground row the plant stands on

/** Black and white (the original look). */
const BW = {
  sky1: "#c4c4c4",
  sky2: "#d2d2d2",
  sky3: "#dfdfdf",
  sky4: "#ececec",
  cloud: "#ffffff",
  cloudShade: "#e4e4e4",
  hill: "#bdbdbd",
  hillTop: "#ababab",
  fieldFar: "#d6d6d6",
  field: "#c2c2c2",
  fieldNear: "#a8a8a8",
  blade: "#878787",
  bush: "#4a4a4a",
  bushDark: "#2f2f2f",
  flower: "#f4f4f4",
  shadow: "#9a9a9a",
  mound: "#5c5c5c",
  wood: "#2a2a2a",
  woodLight: "#4f4f4f",
  leaf0: "#272727",
  leaf1: "#505050",
  leaf2: "#7b7b7b",
  leaf3: "#a9a9a9",
  blossom: "#ffffff",
  fruit: "#efefef",
  fruitShine: "#ffffff",
  fruitDark: "#8f8f8f",
  ink: "#111111",
} as const;

/** Colour, inspired by a bright open-field landscape: blue sky, golden field, green tree. */
const COLOR: Record<keyof typeof BW, string> = {
  sky1: "#3f86d4",
  sky2: "#579ade",
  sky3: "#73afe8",
  sky4: "#94c6f0",
  cloud: "#ffffff",
  cloudShade: "#cfe2f4",
  hill: "#a7c3dc",
  hillTop: "#8fb0cd",
  fieldFar: "#ead48a",
  field: "#d3bd60",
  fieldNear: "#a9b24c",
  blade: "#7c9838",
  bush: "#2f6a33",
  bushDark: "#1e4a24",
  flower: "#e0413f",
  shadow: "#8c9a3f",
  mound: "#7a5230",
  wood: "#4a2f1d",
  woodLight: "#71492b",
  leaf0: "#1d4a2a",
  leaf1: "#2e7638",
  leaf2: "#4c9d44",
  leaf3: "#8bc65a",
  blossom: "#ffd6e0", // pale pink blossoms at full bloom (red is reserved for photo fruit)
  fruit: "#d62828", // one apple per landmark photo
  fruitShine: "#ff8a80",
  fruitDark: "#8e1b1b",
  ink: "#1d2a3a",
};

export const PALETTES = { color: COLOR, bw: BW } as const;
export type PixelPalette = keyof typeof PALETTES;

export type PixelColor = keyof typeof BW;
type Grid = (PixelColor | undefined)[];
export interface PixelPath { color: PixelColor; d: string }
export interface PixelLeaf { x: number; y: number; fall: number; drift: number; delay: number; color: PixelColor }
/** Where a photo fruit hangs: top-left grid cell and size (3x3 apples on big trees, 2x2 on young ones, 1 px berries on small plants). */
export interface FruitSpot { x: number; y: number; size: number }
export interface PixelScene {
  landscape: PixelPath[];
  wood: PixelPath[];
  foliage: PixelPath[];
  fruit: PixelPath[];
  fruitSpots: FruitSpot[];
  falling: PixelLeaf[];
  bird: PixelPath[] | null;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)];

/** Deterministic 0..1 noise per cell. */
function hash(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const newGrid = (): Grid => new Array(GRID_W * GRID_H);
function set(g: Grid, x: number, y: number, c: PixelColor) {
  if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) g[y * GRID_W + x] = c;
}

/** Pick between `levels` with a dithered transition band around each boundary. */
function ditherLevel(t: number, x: number, y: number, levels: number, spread = 0.5) {
  const v = Math.floor(t + (bayer(x, y) - 0.5) * spread);
  return Math.min(levels - 1, Math.max(0, v));
}

function line(g: Grid, x0: number, y0: number, x1: number, y1: number, c: PixelColor) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    set(g, x0, y0, c);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// --- Background: sky, clouds, hills, field, foreground flowers ---------------------------

const CLOUDS: { x: number; y: number; r: number }[][] = [
  [{ x: 14, y: 9, r: 4 }, { x: 20, y: 7, r: 5 }, { x: 27, y: 9, r: 4 }, { x: 22, y: 11, r: 4 }],
  [{ x: 86, y: 6, r: 3.5 }, { x: 92, y: 4, r: 4.5 }, { x: 99, y: 6, r: 4 }, { x: 104, y: 8, r: 3 }],
  [{ x: 40, y: 22, r: 2.5 }, { x: 45, y: 20, r: 3.5 }, { x: 50, y: 22, r: 2.5 }],
  [{ x: 100, y: 25, r: 2.5 }, { x: 105, y: 23, r: 3 }, { x: 110, y: 25, r: 2.5 }],
  [{ x: 4, y: 30, r: 2 }, { x: 8, y: 29, r: 2.5 }],
  [{ x: 70, y: 33, r: 2 }, { x: 74, y: 32, r: 2.5 }, { x: 78, y: 33, r: 2 }],
];

function paintSky(): Grid {
  const g = newGrid();
  // Sky: darker at the top, lighter toward the horizon, dithered between bands.
  for (let y = 0; y < HORIZON; y++) {
    const t = (y / HORIZON) * 3.6;
    for (let x = 0; x < GRID_W; x++) {
      set(g, x, y, (["sky1", "sky2", "sky3", "sky4"] as const)[ditherLevel(t, x, y, 4, 0.3)]);
    }
  }
  return g;
}

function paintClouds(clouds: typeof CLOUDS): Grid {
  const g = newGrid();
  // Clouds: puffy circles with noisy edges, shaded underneath.
  for (const cloud of clouds) {
    const bottom = Math.max(...cloud.map((p) => p.y + p.r));
    for (const p of cloud) {
      for (let y = Math.floor(p.y - p.r - 1); y <= p.y + p.r + 1; y++) {
        for (let x = Math.floor(p.x - p.r - 1); x <= p.x + p.r + 1; x++) {
          if (Math.hypot(x - p.x, (y - p.y) * 1.15) <= p.r + (hash(x, y, 3) - 0.5) * 0.9) {
            set(g, x, y, y >= bottom - 1.5 ? "cloudShade" : "cloud");
          }
        }
      }
    }
  }
  return g;
}

function paintLandscape(crown: number): Grid {
  const g = newGrid();
  // Distant hills just above the horizon.
  for (let x = 0; x < GRID_W; x++) {
    const top = HORIZON - 2 - Math.round(1.2 + 1.2 * Math.sin(x / 9) + 0.8 * Math.sin(x / 4.1 + 1));
    for (let y = top; y < HORIZON; y++) set(g, x, y, y === top ? "hillTop" : "hill");
  }
  // Field: lighter far away, darker up close, with more grass blades nearer.
  const depth = GRID_H - HORIZON;
  for (let y = HORIZON; y < GRID_H; y++) {
    const d = (y - HORIZON) / depth;
    for (let x = 0; x < GRID_W; x++) {
      set(g, x, y, (["fieldFar", "field", "fieldNear"] as const)[ditherLevel(d * 3, x, y, 3, 0.6)]);
      if (hash(x, y, 5) < 0.04 + d * 0.16) {
        set(g, x, y, "blade");
        if (d > 0.45) set(g, x, y - 1, "blade");
      }
    }
  }
  // Shadow of the canopy on the grass, and a soil mound for the young plant.
  if (crown > 0) {
    for (let x = Math.round(BASE_X - crown); x <= BASE_X + crown; x++) {
      for (let y = BASE_Y; y <= BASE_Y + 2; y++) {
        if (Math.hypot((x - BASE_X) / (crown * 0.85), (y - BASE_Y - 0.6) / 1.5) <= 1 && bayer(x, y) < 0.6) set(g, x, y, "shadow");
      }
    }
  } else {
    for (let x = BASE_X - 2; x <= BASE_X + 2; x++) set(g, x, BASE_Y, "mound");
    set(g, BASE_X - 1, BASE_Y - 1, "mound"); set(g, BASE_X, BASE_Y - 1, "mound"); set(g, BASE_X + 1, BASE_Y - 1, "mound");
  }
  // Foreground band of flowering bushes along the bottom edge.
  for (let x = 0; x < GRID_W; x++) {
    const top = GRID_H - 4 - Math.round(1.5 + 1.2 * Math.sin(x / 3.3) + hash(x, 0, 9) * 0.8);
    for (let y = top; y < GRID_H; y++) {
      set(g, x, y, bayer(x, y) < 0.35 ? "bushDark" : "bush");
      if (y > top && hash(x, y, 13) < 0.09) set(g, x, y, "flower");
    }
  }
  return g;
}

// --- The plant ----------------------------------------------------------------------------

// Canopy clusters relative to the crown centre, in crown radii (same layout at every size).
const CLUSTERS = [
  { dx: 0, dy: 0, r: 0.75 },
  { dx: -0.62, dy: 0.42, r: 0.58 },
  { dx: 0.62, dy: 0.4, r: 0.6 },
  { dx: -0.45, dy: -0.3, r: 0.55 },
  { dx: 0.45, dy: -0.32, r: 0.55 },
  { dx: -1.0, dy: 0.72, r: 0.42 },
  { dx: 1.0, dy: 0.7, r: 0.42 },
  { dx: 0, dy: -0.68, r: 0.5 },
  { dx: 0, dy: 0.55, r: 0.55 },
];

const TREE_SPEC: Record<3 | 4 | 5 | 6, { height: number; crown: number; clusters: number; trunk: number }> = {
  3: { height: 14, crown: 6, clusters: 3, trunk: 1 },
  4: { height: 23, crown: 8.5, clusters: 5, trunk: 2 },
  5: { height: 33, crown: 11.5, clusters: 7, trunk: 2 },
  6: { height: 42, crown: 15, clusters: 9, trunk: 3 },
};

const LEAF_LEVELS = ["leaf0", "leaf1", "leaf2", "leaf3"] as const;

function paintSmallPlant(stage: 0 | 1 | 2, wood: Grid, foliage: Grid) {
  const x = BASE_X, y = BASE_Y - 1;
  if (stage === 0) {
    set(wood, x, y - 1, "wood"); set(wood, x + 1, y - 1, "wood");
    set(foliage, x + 1, y - 2, "leaf1");
    return;
  }
  if (stage === 1) {
    for (let i = 0; i < 3; i++) set(foliage, x, y - i, "leaf0");
    set(foliage, x - 1, y - 3, "leaf1"); set(foliage, x - 2, y - 4, "leaf1");
    set(foliage, x + 1, y - 3, "leaf1"); set(foliage, x + 2, y - 4, "leaf1");
    return;
  }
  for (let i = 0; i < 7; i++) set(wood, x, y - i, "wood");
  set(foliage, x - 1, y - 2, "leaf1"); set(foliage, x - 2, y - 3, "leaf2");
  set(foliage, x + 1, y - 4, "leaf1"); set(foliage, x + 2, y - 5, "leaf2");
  for (let dx = -1; dx <= 1; dx++) set(foliage, x + dx, y - 7, "leaf2");
  set(foliage, x, y - 8, "leaf3"); set(foliage, x - 1, y - 6, "leaf1");
}

function paintTree(stage: 3 | 4 | 5 | 6, wood: Grid, foliage: Grid): PixelLeaf[] {
  const { height, crown: R, clusters, trunk } = TREE_SPEC[stage];
  const cx = BASE_X, cy = BASE_Y - height + R;
  const used = CLUSTERS.slice(0, clusters).map((c) => ({ x: cx + c.dx * R, y: cy + c.dy * R, r: c.r * R }));
  const forkY = BASE_Y - Math.round(height * 0.22);

  // Trunk with a lit left edge and a little root flare.
  for (let y = forkY; y <= BASE_Y; y++) {
    const half = trunk / 2 + (y >= BASE_Y - 1 ? 1 : 0);
    const x0 = Math.round(cx - half);
    const x1 = Math.max(x0 + 1, Math.round(cx + half));
    for (let x = x0; x < x1; x++) set(wood, x, y, x === x0 && x1 - x0 > 1 ? "woodLight" : "wood");
  }
  // Branches from the fork out to the clusters.
  for (const c of used.slice(1, 7)) {
    line(wood, cx, forkY, c.x, c.y + c.r * 0.35, "wood");
    if (stage >= 5) line(wood, cx + (c.x < cx ? -1 : 1), forkY, c.x, c.y + c.r * 0.45, "wood"); // thicker limbs
  }
  line(wood, cx, forkY, cx, cy, "wood");

  // Canopy: union of noisy circles, shaded from the upper left, dithered into 4 greys.
  const owner: number[] = new Array(GRID_W * GRID_H).fill(-1);
  used.forEach((c, i) => {
    for (let y = Math.floor(c.y - c.r - 1); y <= c.y + c.r + 1; y++) {
      for (let x = Math.floor(c.x - c.r - 1); x <= c.x + c.r + 1; x++) {
        if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) continue;
        if (Math.hypot(x - c.x, y - c.y) <= c.r + (hash(x, y, 7) - 0.5) * 1.6) owner[y * GRID_W + x] = i;
      }
    }
  });
  const inCanopy = (x: number, y: number) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H && owner[y * GRID_W + x] >= 0;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = owner[y * GRID_W + x];
      if (i < 0) continue;
      const c = used[i];
      const local = 1 - Math.hypot(x - (c.x - c.r * 0.35), y - (c.y - c.r * 0.35)) / (c.r * 1.45);
      const global = 0.5 - ((x - cx) / R) * 0.12 - ((y - cy) / R) * 0.2;
      const clump = hash(Math.floor(x / 2), Math.floor(y / 2), 17) - 0.5; // 2x2 leaf clumps
      const value = 0.55 * local + 0.45 * global + clump * 0.22;
      let level = ditherLevel(value * 4, x, y, 4, 0.45);
      if (!inCanopy(x, y + 1) || !inCanopy(x + 1, y)) level = Math.max(0, level - 1); // shadow edge
      if (!inCanopy(x, y + 1) && !inCanopy(x + 1, y)) level = 0;
      set(foliage, x, y, LEAF_LEVELS[level]);
      if (stage === 6 && level >= 1 && level <= 2 && hash(x, y, 23) < 0.035) set(foliage, x, y, "blossom");
    }
  }

  // Falling leaves start in the lower canopy and drift to the ground.
  const count = stage === 6 ? 7 : stage === 5 ? 5 : stage === 4 ? 3 : 1;
  const leaves: PixelLeaf[] = [];
  for (let k = 0; k < count; k++) {
    const c = used[(k * 2 + 1) % used.length];
    const x = Math.round(c.x + (hash(k, 1, 31) - 0.5) * c.r);
    const y = Math.round(c.y + c.r * 0.5);
    leaves.push({
      x, y,
      fall: BASE_Y - y,
      drift: Math.round((hash(k, 2, 37) - 0.5) * 12),
      delay: Math.round(hash(k, 3, 41) * 70) / 10,
      color: stage === 6 && k % 2 === 1 ? "blossom" : k % 2 ? "leaf1" : "leaf2",
    });
  }
  return leaves;
}

// --- Grid -> SVG paths --------------------------------------------------------------------

function toPaths(g: Grid): PixelPath[] {
  const byColor = new Map<PixelColor, string[]>();
  for (let y = 0; y < GRID_H; y++) {
    let x = 0;
    while (x < GRID_W) {
      const c = g[y * GRID_W + x];
      let n = 1;
      while (x + n < GRID_W && g[y * GRID_W + x + n] === c) n++;
      if (c) {
        if (!byColor.has(c)) byColor.set(c, []);
        byColor.get(c)!.push(`M${x} ${y}h${n}v1h-${n}z`);
      }
      x += n;
    }
  }
  return [...byColor].map(([color, parts]) => ({ color, d: parts.join("") }));
}

const BIRD = ["X...X", ".X.X.", "..X.."];
function birdPaths(): PixelPath[] {
  const g = newGrid();
  BIRD.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === "X") set(g, 80 + dx, 13 + dy, "ink"); }));
  return toPaths(g);
}

/**
 * Picks spots for `count` fruits on the plant: inside the lower canopy (away from the trunk)
 * on trees, on the leaves of small plants. Farthest-point sampling spreads them out, and the
 * order is stable, so fruit i (the user's i-th unlock) keeps its place as more are added.
 */
function pickFruitSpots(stage: TreeStage, foliage: Grid, count: number): FruitSpot[] {
  if (count <= 0 || stage === 0) return [];
  const size = stage >= 5 ? 3 : stage >= 3 ? 2 : 1;
  const leafy = (x: number, y: number) => (foliage[y * GRID_W + x] ?? "").startsWith("leaf");
  let minY = 0;
  let start: [number, number] = [BASE_X - 3, BASE_Y];
  if (stage >= 3) {
    const { height, crown: R } = TREE_SPEC[stage as 3 | 4 | 5 | 6];
    const cy = BASE_Y - height + R;
    minY = cy - R * 0.15;
    start = [BASE_X - R * 0.7, cy + R * 0.55];
  }
  const candidates: [number, number][] = [];
  for (let y = Math.ceil(minY); y < GRID_H - size; y++) {
    for (let x = 0; x < GRID_W - size; x++) {
      let fits = true;
      for (let dy = 0; dy < size && fits; dy++) for (let dx = 0; dx < size && fits; dx++) fits = leafy(x + dx, y + dy);
      // Keep fruit off the trunk line, and berries off the small plant's stem.
      if (fits && (stage < 3 ? x !== BASE_X : Math.abs(x + size / 2 - BASE_X) > 2)) candidates.push([x, y]);
    }
  }
  if (candidates.length === 0) return [];
  const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 1.2);
  const chosen: [number, number][] = [candidates.reduce((best, c) => (dist(c, start) < dist(best, start) ? c : best))];
  while (chosen.length < Math.min(count, candidates.length)) {
    let best = candidates[0], bestScore = -1;
    for (const c of candidates) {
      const score = Math.min(...chosen.map((q) => dist(c, q)));
      if (score > bestScore) { best = c; bestScore = score; }
    }
    chosen.push(best);
  }
  return chosen.map(([x, y]) => ({ x, y, size }));
}

function paintFruit(spots: FruitSpot[]): Grid {
  const g = newGrid();
  for (const { x, y, size } of spots) {
    if (size === 1) { set(g, x, y, "fruit"); continue; }
    if (size === 2) {
      set(g, x, y, "fruitShine"); set(g, x + 1, y, "fruit");
      set(g, x, y + 1, "fruit"); set(g, x + 1, y + 1, "fruitDark");
      continue;
    }
    // 3x3 apple: highlight top-left, shade bottom-right, rounded bottom.
    set(g, x, y, "fruitShine"); set(g, x + 1, y, "fruit"); set(g, x + 2, y, "fruit");
    set(g, x, y + 1, "fruit"); set(g, x + 1, y + 1, "fruit"); set(g, x + 2, y + 1, "fruitDark");
    set(g, x + 1, y + 2, "fruitDark");
  }
  return g;
}

const cache = new Map<string, PixelScene>();
export const SKY_PATHS = toPaths(paintSky());
export const CLOUD_LAYERS = [toPaths(paintClouds(CLOUDS.slice(2))), toPaths(paintClouds(CLOUDS.slice(0, 2)))];

export function pixelScene(stage: TreeStage, fruitCount = 0): PixelScene {
  const key = `${stage}:${fruitCount}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const wood = newGrid();
  const foliage = newGrid();
  let falling: PixelLeaf[] = [];
  if (stage <= 2) paintSmallPlant(stage as 0 | 1 | 2, wood, foliage);
  else falling = paintTree(stage as 3 | 4 | 5 | 6, wood, foliage);
  const crown = stage >= 3 ? TREE_SPEC[stage as 3 | 4 | 5 | 6].crown : 0;
  const fruitSpots = pickFruitSpots(stage, foliage, fruitCount);
  const scene: PixelScene = {
    landscape: toPaths(paintLandscape(crown)),
    wood: toPaths(wood),
    foliage: toPaths(foliage),
    fruit: toPaths(paintFruit(fruitSpots)),
    fruitSpots,
    falling,
    bird: stage === 6 ? birdPaths() : null,
  };
  cache.set(key, scene);
  return scene;
}

