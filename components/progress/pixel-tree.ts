import type { BloomLevel, TreeSpecies, TreeStage } from "@/lib/progress";

// Black-and-white pixel-art scene for the progress tree: one tree, centred in a wide open
// field under a big sky. The tree can be one of six species (ADR 0030), each with its own
// canopy shapes and colours, and keeps changing after full bloom (bloom levels 1-3). Everything is painted on a coarse grid (1 unit = 1 "pixel") and
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

/** Per-species colours (colour palette only; black and white keeps its greys and shows the shape).
 *  Photo fruit stays red on every species. */
const SPECIES_COLORS: Record<TreeSpecies, Partial<Record<keyof typeof BW, string>>> = {
  classic: {},
  sakura: { leaf0: "#a8506f", leaf1: "#d97f9f", leaf2: "#f2adc3", leaf3: "#ffdbe6", blossom: "#ffffff", wood: "#3b2420", woodLight: "#5a3a31" },
  maple: { leaf0: "#7c2d12", leaf1: "#b9471a", leaf2: "#e8892a", leaf3: "#f8c445", blossom: "#fff1c2" },
  pine: { leaf0: "#0f3322", leaf1: "#1c4d33", leaf2: "#2b6a44", leaf3: "#4f8a5c", blossom: "#8b5a2b" },
  willow: { leaf0: "#3d5f22", leaf1: "#5f8a2e", leaf2: "#8cb547", leaf3: "#c3dc7a", blossom: "#f4f7c9" },
  sequoia: { leaf0: "#1c3b26", leaf1: "#2c5a35", leaf2: "#457a44", leaf3: "#6f9c5a", blossom: "#a3532e", wood: "#6b2f1c", woodLight: "#9a4a2c" },
};

export function treeColors(palette: PixelPalette, species: TreeSpecies): Record<keyof typeof BW, string> {
  return palette === "color" ? { ...COLOR, ...SPECIES_COLORS[species] } : BW;
}

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

function paintLandscape(crown: number, wildflowers = false): Grid {
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
  // Wildflower meadow (bloom level 2+): a ring of flowers around the trunk.
  if (wildflowers && crown > 0) {
    for (let x = Math.round(BASE_X - crown * 1.4); x <= BASE_X + crown * 1.4; x++) {
      for (let y = BASE_Y - 1; y <= BASE_Y + 3; y++) {
        if (Math.abs(x - BASE_X) > 2 && hash(x, y, 83) < 0.22) set(g, x, y, "flower");
      }
    }
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

/** One canopy shape: an ellipse, or a triangle (pine tiers) with its apex `ry` above `y`. */
interface Blob { x: number; y: number; rx: number; ry: number; tri?: boolean }
/** Everything the painter needs for one species at one stage. */
interface Crown {
  blobs: Blob[];
  cy: number;          // crown centre row, used for shading and fruit
  R: number;           // crown radius
  forkY: number;       // where branches leave the trunk
  trunk: number;       // trunk width
  branches: boolean;   // limbs out to each blob
  topY: number;        // the trunk's highest point
  strands: boolean;    // willow: hanging strands under the crown
  shadow: number;      // half-width of the shadow on the grass
}

function crownFor(species: TreeSpecies, stage: 3 | 4 | 5 | 6): Crown {
  const { height, crown: R, clusters, trunk } = TREE_SPEC[stage];
  const cx = BASE_X, top = BASE_Y - height;
  const classic = (sx: number, sy: number, sr: number, cy: number): Blob[] =>
    CLUSTERS.slice(0, clusters).map((c) => ({ x: cx + c.dx * R * sx, y: cy + c.dy * R * sy, rx: c.r * R * sr, ry: c.r * R * sr }));
  const base = { trunk, branches: true, strands: false, forkY: BASE_Y - Math.round(height * 0.22) };

  switch (species) {
    case "sakura": { // wide, flat, spreading crown
      const cy = top + R * 0.85;
      return { ...base, cy, R, topY: cy, shadow: R * 1.25,
        blobs: classic(1.3, 0.6, 1, cy).map((b) => ({ ...b, rx: b.rx * 1.15, ry: b.ry * 0.8 })) };
    }
    case "maple": { // dense, round
      const cy = top + R;
      return { ...base, cy, R, topY: cy, shadow: R, blobs: classic(0.85, 0.85, 1.12, cy) };
    }
    case "willow": { // low dome with strands hanging below
      const cy = top + R * 0.9;
      return { ...base, cy, R, topY: cy, strands: true, shadow: R * 1.1,
        blobs: classic(1.05, 0.65, 1, cy).map((b) => ({ ...b, ry: b.ry * 0.85 })) };
    }
    case "pine": { // stacked triangular tiers on a straight trunk
      const tiers = stage - 1, bottom = BASE_Y - height * 0.22, span = bottom - top;
      const blobs: Blob[] = Array.from({ length: tiers }, (_, t) => {
        const f = tiers === 1 ? 1 : t / (tiers - 1); // 0 = top tier, 1 = bottom tier
        const ry = (span / tiers) * 0.95;
        return { x: cx, y: top + ry + (span - 2 * ry) * f + ry * 0.4, rx: R * (0.35 + 0.5 * f), ry, tri: true };
      });
      return { ...base, blobs, cy: top + span * 0.55, R: R * 0.75, branches: false, topY: top, shadow: R * 0.8 };
    }
    case "sequoia": { // long bare red trunk, narrow column of clumps up top
      const cy = top + height * 0.33;
      const n = Math.max(3, clusters - 1);
      const blobs: Blob[] = Array.from({ length: n }, (_, k) => ({
        x: cx + (hash(k, stage, 51) - 0.5) * R * 0.5,
        y: top + R * 0.35 + (height * 0.55 - R * 0.35) * (k / (n - 1)),
        rx: R * (0.42 + 0.12 * (k / (n - 1))), ry: R * 0.4,
      }));
      return { ...base, blobs, cy, R: R * 0.7, trunk: trunk + 1, branches: false, topY: top + 1,
        forkY: BASE_Y - Math.round(height * 0.38), shadow: R * 0.6 };
    }
    default: {
      const cy = top + R;
      return { ...base, cy, R, topY: cy, shadow: R, blobs: classic(1, 1, 1, cy) };
    }
  }
}

function inBlob(b: Blob, x: number, y: number, noise: number): boolean {
  if (!b.tri) return Math.hypot((x - b.x) / b.rx, (y - b.y) / b.ry) <= 1 + noise / Math.max(b.rx, b.ry);
  const apex = b.y - b.ry, bottom = b.y + b.ry;
  if (y < apex - 0.5 || y > bottom + 0.5) return false;
  return Math.abs(x - b.x) <= b.rx * ((y - apex) / (2 * b.ry)) + noise * 0.6;
}

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

function paintTree(stage: 3 | 4 | 5 | 6, species: TreeSpecies, bloom: BloomLevel, wood: Grid, foliage: Grid): { leaves: PixelLeaf[]; crown: Crown } {
  const crown = crownFor(species, stage);
  const { blobs, cy, R, forkY, trunk } = crown;
  const cx = BASE_X;

  // Trunk with a lit left edge and a little root flare.
  for (let y = forkY; y <= BASE_Y; y++) {
    const half = trunk / 2 + (y >= BASE_Y - 1 ? 1 : 0);
    const x0 = Math.round(cx - half);
    const x1 = Math.max(x0 + 1, Math.round(cx + half));
    for (let x = x0; x < x1; x++) set(wood, x, y, x === x0 && x1 - x0 > 1 ? "woodLight" : "wood");
  }
  // Branches from the fork out to the clusters (broadleaf trees), or a straight leader.
  if (crown.branches) {
    for (const b of blobs.slice(1, 7)) {
      line(wood, cx, forkY, b.x, b.y + b.ry * 0.35, "wood");
      if (stage >= 5) line(wood, cx + (b.x < cx ? -1 : 1), forkY, b.x, b.y + b.ry * 0.45, "wood"); // thicker limbs
    }
  }
  line(wood, cx, forkY, cx, crown.topY, "wood");

  // Canopy: union of noisy shapes, shaded from the upper left, dithered into 4 tones.
  const owner: number[] = new Array(GRID_W * GRID_H).fill(-1);
  blobs.forEach((b, i) => {
    for (let y = Math.floor(b.y - b.ry - 1); y <= b.y + b.ry + 1; y++) {
      for (let x = Math.floor(b.x - b.rx - 1); x <= b.x + b.rx + 1; x++) {
        if (x < 0 || x >= GRID_W || y < 0 || y >= GRID_H) continue;
        if (inBlob(b, x, y, (hash(x, y, 7) - 0.5) * 1.6)) owner[y * GRID_W + x] = i;
      }
    }
  });
  // Willow strands: hang from the underside of the crown, in leaf colours, with small gaps.
  if (crown.strands) {
    for (let x = 0; x < GRID_W; x++) {
      let low = -1;
      for (let y = GRID_H - 1; y >= 0; y--) if (owner[y * GRID_W + x] >= 0) { low = y; break; }
      if (low < 0 || hash(x, 0, 61) < 0.35 || Math.abs(x - cx) <= trunk) continue;
      const length = Math.round(R * (0.5 + hash(x, 1, 67) * 0.6));
      for (let y = low + 1; y <= Math.min(BASE_Y - 2, low + length); y++) {
        if (hash(x, y, 71) < 0.12) continue;
        owner[y * GRID_W + x] = -2; // strand pixel, painted below
      }
    }
  }
  const inCanopy = (x: number, y: number) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H && owner[y * GRID_W + x] >= 0;
  const blossomRate = stage === 6 ? (bloom >= 3 ? 0.07 : 0.035) : 0;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = owner[y * GRID_W + x];
      if (i === -2) { set(foliage, x, y, (x + y) % 3 === 0 ? "leaf1" : "leaf2"); continue; }
      if (i < 0) continue;
      const b = blobs[i], r = (b.rx + b.ry) / 2;
      const local = 1 - Math.hypot(x - (b.x - r * 0.35), y - (b.y - r * 0.35)) / (r * 1.45);
      const global = 0.5 - ((x - cx) / R) * 0.12 - ((y - cy) / R) * 0.2;
      const clump = hash(Math.floor(x / 2), Math.floor(y / 2), 17) - 0.5; // 2x2 leaf clumps
      const value = 0.55 * local + 0.45 * global + clump * 0.22;
      let level = ditherLevel(value * 4, x, y, 4, 0.45);
      if (!inCanopy(x, y + 1) || !inCanopy(x + 1, y)) level = Math.max(0, level - 1); // shadow edge
      if (!inCanopy(x, y + 1) && !inCanopy(x + 1, y)) level = 0;
      set(foliage, x, y, LEAF_LEVELS[level]);
      if (level >= 1 && level <= 2 && hash(x, y, 23) < blossomRate) set(foliage, x, y, "blossom");
    }
  }

  // Falling leaves (petals for sakura) start in the lower canopy and drift to the ground.
  const count = stage === 6 ? 7 : stage === 5 ? 5 : stage === 4 ? 3 : 1;
  const leaves: PixelLeaf[] = [];
  for (let k = 0; k < count; k++) {
    const b = blobs[(k * 2 + 1) % blobs.length];
    const x = Math.round(b.x + (hash(k, 1, 31) - 0.5) * b.rx);
    const y = Math.round(b.y + b.ry * 0.5);
    leaves.push({
      x, y,
      fall: BASE_Y - y,
      drift: Math.round((hash(k, 2, 37) - 0.5) * 12),
      delay: Math.round(hash(k, 3, 41) * 70) / 10,
      color: species === "sakura" ? (k % 2 ? "leaf3" : "leaf2") : stage === 6 && k % 2 === 1 ? "blossom" : k % 2 ? "leaf1" : "leaf2",
    });
  }
  return { leaves, crown };
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
/** Full bloom has one bird; songbird tree (bloom 1) a second, ancient tree (bloom 3) a third. */
const BIRD_SPOTS = [[80, 13], [30, 10], [97, 19]] as const;
function birdPaths(count: number): PixelPath[] {
  const g = newGrid();
  for (const [bx, by] of BIRD_SPOTS.slice(0, count)) {
    BIRD.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === "X") set(g, bx + dx, by + dy, "ink"); }));
  }
  return toPaths(g);
}

/**
 * Picks spots for `count` fruits on the plant: inside the lower canopy (away from the trunk)
 * on trees, on the leaves of small plants. Farthest-point sampling spreads them out, and the
 * order is stable, so fruit i (the user's i-th unlock) keeps its place as more are added.
 */
function pickFruitSpots(stage: TreeStage, foliage: Grid, count: number, crown: Crown | null): FruitSpot[] {
  if (count <= 0 || stage === 0) return [];
  const size = stage >= 5 ? 3 : stage >= 3 ? 2 : 1;
  const leafy = (x: number, y: number) => (foliage[y * GRID_W + x] ?? "").startsWith("leaf");
  let minY = 0;
  let start: [number, number] = [BASE_X - 3, BASE_Y];
  if (crown) {
    const { cy, R } = crown;
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

export function pixelScene(stage: TreeStage, fruitCount = 0, species: TreeSpecies = "classic", bloom: BloomLevel = 0): PixelScene {
  if (stage !== 6) bloom = 0; // levels after full bloom only
  const key = `${species}:${stage}:${fruitCount}:${bloom}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const wood = newGrid();
  const foliage = newGrid();
  let falling: PixelLeaf[] = [];
  let crown: Crown | null = null;
  if (stage <= 2) paintSmallPlant(stage as 0 | 1 | 2, wood, foliage);
  else ({ leaves: falling, crown } = paintTree(stage as 3 | 4 | 5 | 6, species, bloom, wood, foliage));
  const fruitSpots = pickFruitSpots(stage, foliage, fruitCount, crown);
  const scene: PixelScene = {
    landscape: toPaths(paintLandscape(crown?.shadow ?? 0, bloom >= 2)),
    wood: toPaths(wood),
    foliage: toPaths(foliage),
    fruit: toPaths(paintFruit(fruitSpots)),
    fruitSpots,
    falling,
    bird: stage === 6 ? birdPaths(bloom >= 3 ? 3 : bloom >= 1 ? 2 : 1) : null,
  };
  cache.set(key, scene);
  return scene;
}
