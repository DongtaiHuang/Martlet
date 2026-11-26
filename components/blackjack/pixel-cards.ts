// Pixel art for Blackjack (ADR 0044): cards (20 x 30), the card back, chips, the felt and a coin.
// Relative .ts imports keep this importable by node --test.
import { CAMPUS, MARTY } from "../../lib/pixel/palette.ts";
import { blank, grid, overlay, spriteSvg, toSprite, type Grid, type Sprite } from "../../lib/pixel/sprite.ts";

export const CARD_W = 20;
export const CARD_H = 30;

// 3 x 5 rank glyphs ("10" is 5 wide).
const RANK: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], 2: ["##.", "..#", ".#.", "#..", "###"], 3: ["##.", "..#", ".#.", "..#", "##."],
  4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "##.", "..#", "##."], 6: [".##", "#..", "###", "#.#", "###"],
  7: ["###", "..#", ".#.", ".#.", ".#."], 8: ["###", "#.#", "###", "#.#", "###"], 9: ["###", "#.#", "###", "..#", "##."],
  10: ["#.###", "#.#.#", "#.#.#", "#.#.#", "#.###"], J: ["..#", "..#", "..#", "#.#", ".#."],
  Q: [".#.", "#.#", "#.#", "##.", ".##"], K: ["#.#", "##.", "#..", "##.", "#.#"],
};
// 9 x 9 suits for the middle and 3 x 3 ones for the corners.
const SUIT: Record<string, { big: string[]; small: string[] }> = {
  "♥": { small: ["#.#", "###", ".#."], big: [
    ".##...##.", "####.####", "#########", "#########", ".#######.", "..#####..", "...###...", "....#....", ".........",
  ] },
  "♦": { small: [".#.", "###", ".#."], big: [
    "....#....", "...###...", "..#####..", ".#######.", "#########", ".#######.", "..#####..", "...###...", "....#....",
  ] },
  "♠": { small: [".#.", "###", "#.#"], big: [
    "....#....", "...###...", "..#####..", ".#######.", "#########", "#########", ".##.#.##.", "....#....", "...###...",
  ] },
  "♣": { small: ["###", "###", ".#."], big: [
    "...###...", "..#####..", "..#####..", "##.###.##", "#########", "##.###.##", "....#....", "...###...", ".........",
  ] },
};

const ink = (rows: string[], letter: string): Grid => grid(rows.map((r) => r.replace(/#/g, letter)));
const rotate180 = (g: Grid): Grid => g.map((row) => [...row].reverse()).reverse();

/** A rounded card outline filled with `fill`. */
function cardBase(fill: string): Grid {
  const g = blank(CARD_W, CARD_H);
  for (let y = 0; y < CARD_H; y++) for (let x = 0; x < CARD_W; x++) {
    const edgeX = x === 0 || x === CARD_W - 1, edgeY = y === 0 || y === CARD_H - 1;
    const corner = (x < 1 || x > CARD_W - 2) && (y < 1 || y > CARD_H - 2);
    if (corner) continue;
    g[y][x] = edgeX || edgeY || ((x === 1 || x === CARD_W - 2) && (y === 1 || y === CARD_H - 2)) ? "K" : fill;
  }
  // Round the corners: the cell next to each outline corner is outline too.
  for (const [x, y] of [[1, 1], [CARD_W - 2, 1], [1, CARD_H - 2], [CARD_W - 2, CARD_H - 2]]) g[y][x] = "K";
  return g;
}

const FACE_COLORS = { K: MARTY.outline, W: "#fffaf2", S: "#ece3d4", R: "#c0263a", B: "#26222e" };

const cardCache = new Map<string, Sprite>();

/** A face-up card from its rank ("A", "2".."10", "J", "Q", "K") and suit symbol. */
export function cardFace(rank: string, suit: string, red: boolean): Sprite {
  const key = `${rank}${suit}`;
  const hit = cardCache.get(key);
  if (hit) return hit;
  const letter = red ? "R" : "B";
  let g = cardBase("W");
  for (let y = CARD_H - 3; y < CARD_H - 1; y++) for (let x = 2; x < CARD_W - 2; x++) g[y][x] = "S"; // shadowed lower edge
  const rankGrid = ink(RANK[rank] ?? RANK.A, letter);
  const small = ink(SUIT[suit]?.small ?? SUIT["♠"].small, letter);
  const big = ink(SUIT[suit]?.big ?? SUIT["♠"].big, letter);
  // Top-left rank and suit; the same, upside down, bottom-right; a big suit in the middle.
  g = overlay(g, rankGrid, 2, 2);
  g = overlay(g, small, 2, 8);
  const corner = rotate180(overlay(overlay(blank(5, 11), rankGrid, 0, 0), small, 0, 6));
  g = overlay(g, corner, CARD_W - 7, CARD_H - 14);
  g = overlay(g, big, 6, 11);
  const sprite = toSprite(g, FACE_COLORS);
  cardCache.set(key, sprite);
  return sprite;
}

/** The back: burgundy with a cream lattice, like Marty's colours. */
export const CARD_BACK: Sprite = (() => {
  const g = cardBase("A");
  for (let y = 2; y < CARD_H - 2; y++) for (let x = 2; x < CARD_W - 2; x++) {
    if (x === 2 || x === CARD_W - 3 || y === 2 || y === CARD_H - 3) g[y][x] = "C";
    else if ((x + y) % 4 === 0 || (x - y + 400) % 4 === 0) g[y][x] = "B";
  }
  return toSprite(g, { K: MARTY.outline, A: MARTY.body, B: MARTY.cap, C: MARTY.cream });
})();

// Chips: 14 x 14, coloured by value, with cream edge marks.
const CHIP_COLORS: Record<number, { body: string; dark: string }> = {
  5: { body: "#c0263a", dark: "#8e1b2b" }, 10: { body: "#3a6fc4", dark: "#27508f" }, 25: { body: "#2e8a4a", dark: "#1f6334" },
  50: { body: "#e0812a", dark: "#a95a17" }, 100: { body: "#2a2a35", dark: "#15151c" },
};
const CHIP = [
  "....KKKKKK....",
  "..KKCBBBBCKK..",
  ".KBBBBBBBBBBK.",
  ".KBBDDDDDDBBK.",
  "KCBDDDDDDDDBCK",
  "KBBDDDDDDDDBBK",
  "KBBDDDDDDDDBBK",
  "KBBDDDDDDDDBBK",
  "KBBDDDDDDDDBBK",
  "KCBDDDDDDDDBCK",
  ".KBBDDDDDDBBK.",
  ".KBBBBBBBBBBK.",
  "..KKCBBBBCKK..",
  "....KKKKKK....",
];
const chipCache = new Map<number, Sprite>();
export function chipSprite(value: number): Sprite {
  const hit = chipCache.get(value);
  if (hit) return hit;
  const c = CHIP_COLORS[value] ?? CHIP_COLORS[5];
  const s = toSprite(grid(CHIP), { K: MARTY.outline, B: c.body, D: c.dark, C: MARTY.cream });
  chipCache.set(value, s);
  return s;
}

/** The points coin shown by the balance. */
export const COIN: Sprite = toSprite(grid([
  "..KKKK..",
  ".KGGGGK.",
  "KGGwGGgK",
  "KGwGGGgK",
  "KGGGGGgK",
  "KGGGGggK",
  ".KggggK.",
  "..KKKK..",
]), { K: "#5a3d12", G: CAMPUS.gold, g: CAMPUS.goldShade, w: CAMPUS.white });

/** The felt, as a CSS background: two greens dithered in a 4 x 4 tile. */
export const FELT_TILE = `url("data:image/svg+xml,${encodeURIComponent(spriteSvg(toSprite(grid([
  "AAAA", "ABAA", "AAAA", "AAAB",
]), { A: "#1f6b46", B: "#235f42" })))}")`;
