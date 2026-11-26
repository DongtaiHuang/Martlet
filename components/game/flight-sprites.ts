// Pixel art for Martlet Flight (ADR 0044): a compact Marty sized to the game's hitbox, with three
// wing frames, the avatar accessories, a landmark pin, clouds, the moon and a 3x5 digit font.
// Relative .ts imports keep this importable by node --test.
import { CAMPUS, MARTY, martletRamp } from "../../lib/pixel/palette.ts";
import { grid, overlay, toSprite, type Grid, type Sprite } from "../../lib/pixel/sprite.ts";

// Marty in profile, facing right (22 x 14). K outline, C/A cap, B body, T/L tail, H/S/Z cream
// chest and shades, O/Q beak, P blush, E eye.
const BODY = [
  "..............KKK.....",
  "............KKCCAK....",
  "...........KAAAAAAK...",
  "..........KAAAHHHHHK..",
  "KK.......KBBAHHHEHHHK.",
  "KLKK....KBBBAHHHHHHOOK",
  ".KTTKK.KBBBBBHHHPHHQK.",
  "..KTTTKBBBBBBHHHHHHK..",
  "..KLTTBBBBBBBBHHHHHK..",
  ".KTTKKBBBBBBBSSHHHK...",
  "KTKK..KBBBBBSSSSSSK...",
  "KK.....KKSSSSSSZZK....",
  ".........KKZZZZKK.....",
  "...........KKKK.......",
];

// Wing frames, drawn over the body: W light, X mid, Y dark.
const WING = {
  up: [
    "......KK..............",
    ".....KWWK.............",
    "....KWWXXK............",
    ".....KXXXYK...........",
    "......KXYYYK..........",
    ".......KKKKK..........",
  ],
  mid: [
    "",
    "........KKKKK.........",
    ".......KWWWWXK........",
    "......KXXXXXYK........",
    ".......KYYYYK.........",
    "........KKKK..........",
  ],
  down: [
    "",
    "",
    "",
    ".......KKKKKK.........",
    "......KXXXXXYK........",
    ".......KYYYYYK........",
    "........KYYYK.........",
    ".........KKK..........",
  ],
} as const;
const WING_TOP = { up: 0, mid: 5, down: 5 } as const;

// Accessories (avatar items), positioned on the 22 x 14 body.
const ITEM_ART: Record<string, { rows: string[]; x: number; y: number; behind?: boolean }> = {
  beanie: { rows: ["...ww...", "..RRRR..", ".RRRRRR.", "wwwwwwww"], x: 10, y: -3 },
  gradcap: { rows: ["....N....", "NNNNNNNNN", "..NNNNNg.", "..NNNN.g."], x: 10, y: -3 },
  scarf: { rows: ["RRwRRRR", ".RRwRRR", "..RR..."], x: 12, y: 9 },
  camera: { rows: ["NNNN", "NcNN", "NNNN"], x: 13, y: 10 },
  backpack: { rows: [".bbbb", "bbBBb", "bbBBb", ".bbbb"], x: 5, y: 3, behind: true },
};
const ITEM_COLORS = { R: "#a6192e", w: "#ffffff", N: "#1f1f24", g: CAMPUS.gold, c: "#9fd4f5", b: "#6b4f2a", B: "#8a6a3d" };

export type Wing = keyof typeof WING;
export const BIRD_W = 22;
export const BIRD_H = 14;
/** Where the art sits relative to the hitbox centre (the bird's body centre). */
export const BIRD_OFFSET = { x: -11, y: -8 };

const cache = new Map<string, Record<Wing, Sprite>>();

/** Marty's three wing frames in a plumage, wearing the given items. Cached per look. */
export function birdFrames(plumage: { id: string; body: string; wing: string }, wearing: readonly string[]): Record<Wing, Sprite> {
  const key = `${plumage.id}|${[...wearing].sort().join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ramp = martletRamp(plumage.body, plumage.wing, plumage.id === "marty");
  const colors = {
    ...ITEM_COLORS, // behind-body items are painted first in the grid, so order only matters for paths
    K: MARTY.outline, C: ramp.capLight, A: ramp.cap, B: ramp.body, T: ramp.tail, L: ramp.tailLight,
    H: MARTY.cream, S: MARTY.creamShade, Z: MARTY.creamDark, O: MARTY.beak, Q: MARTY.beakShade, P: MARTY.blush, E: MARTY.eye,
    W: ramp.wingLight, X: ramp.wing, Y: ramp.wingDark,
  };
  // Pad 3 rows above for hats.
  const pad = 3;
  const base = (): Grid => grid([...Array(pad).fill("".padEnd(BIRD_W, ".")), ...BODY]);
  const frames = {} as Record<Wing, Sprite>;
  for (const wing of Object.keys(WING) as Wing[]) {
    let g = base();
    for (const id of wearing) { const item = ITEM_ART[id]; if (item?.behind) g = overlay(g, grid(item.rows), item.x, item.y + pad); }
    g = overlay(g, grid(BODY), 0, pad); // body over anything behind it
    g = overlay(g, grid(WING[wing]), 0, WING_TOP[wing] + pad);
    for (const id of wearing) { const item = ITEM_ART[id]; if (item && !item.behind) g = overlay(g, grid(item.rows), item.x, item.y + pad); }
    frames[wing] = toSprite(g, colors);
  }
  cache.set(key, frames);
  return frames;
}
/** Rows of padding above the body in every bird frame (room for hats). */
export const BIRD_PAD = 3;

// A gold landmark pin (7 x 10).
export const PIN = toSprite(grid([
  "..KKK..",
  ".KGGGK.",
  "KGGwGGK",
  "KGwwwgK",
  "KGGwGgK",
  ".KGggK.",
  ".KGgK..",
  "..KgK..",
  "..KK...",
  "...K...",
]), { K: "#5a3d12", G: CAMPUS.gold, g: CAMPUS.goldShade, w: CAMPUS.white });

export const CLOUD = toSprite(grid([
  ".......WWWW.........",
  ".....WWWWWWW........",
  "..WWWWWWWWWWWWWW....",
  ".WWWWWWWWWWWWWWWWW..",
  "WWWWWWWWWWWWWWWWWWWW",
  ".SSSSSSSSSSSSSSSSSS.",
]), { W: CAMPUS.white, S: "#cfe2f4" });

export const MOON = toSprite(grid([
  "...MMMM...",
  ".MMMMMMMM.",
  ".MMMmMMMM.",
  "MMMMMMMmMM",
  "MMmMMMMMMM",
  "MMMMMMMMMM",
  "MMMMMmMMMM",
  ".MMMMMMMM.",
  ".MMmMMMMM.",
  "...MMMM...",
]), { M: "#f4f1e8", m: "#d8d2c0" });

// 3 x 5 digits.
const DIGITS = [
  ["###", "#.#", "#.#", "#.#", "###"], [".#.", "##.", ".#.", ".#.", "###"], ["###", "..#", "###", "#..", "###"],
  ["###", "..#", ".##", "..#", "###"], ["#.#", "#.#", "###", "..#", "..#"], ["###", "#..", "###", "..#", "###"],
  ["###", "#..", "###", "#.#", "###"], ["###", "..#", ".#.", ".#.", ".#."], ["###", "#.#", "###", "#.#", "###"],
  ["###", "#.#", "###", "..#", "###"],
];

/** A number in the pixel font, with a dark outline so it reads on any sky. Each digit is 4 wide. */
export function numberSprite(n: number): Sprite {
  const text = String(Math.max(0, Math.floor(n)));
  const rows = Array.from({ length: 5 }, (_, y) => [...text].map((d) => DIGITS[Number(d)][y]).join(".").replace(/#/g, "W"));
  const g = grid(["", ...rows.map((r) => `.${r}.`), ""]);
  // Outline (8-neighbours) for legibility.
  const out = g.map((row) => [...row]);
  g.forEach((row, y) => row.forEach((c, x) => {
    if (c !== ".") return;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy]?.[x + dx] === "W") out[y][x] = "K";
  }));
  return toSprite(out, { K: MARTY.outline, W: CAMPUS.white });
}
