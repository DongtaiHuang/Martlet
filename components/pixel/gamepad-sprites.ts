// Pixel art for the on-screen gamepad (ADR 0044): a D-pad and round A/B buttons, in Marty's
// colours. Our own simple design. Relative .ts imports keep this testable with node --test.
import { CAMPUS, MARTY } from "../../lib/pixel/palette.ts";
import { grid, toSprite, type Grid, type Sprite } from "../../lib/pixel/sprite.ts";

export type Dir = "up" | "down" | "left" | "right";

// 21 x 21 cross. K outline, D pad, H top highlight, S lower shade, C centre dimple.
const DPAD = [
  ".......KKKKKKK.......",
  ".......KHHHHHDK......",
  ".......KDDDDDDK......",
  ".......KDDKDDDK......",
  ".......KDKKKDDK......",
  ".......KDDDDDDK......",
  ".......KDDDDDDK......",
  "KKKKKKKKDDDDDDKKKKKKK",
  "KHDDDDDDDDDDDDDDDDDSK",
  "KDDDKDDDDDDDDDDDKDDSK",
  "KDDKKDDDDDCDDDDDKKDSK",
  "KDDDKDDDDDDDDDDDKDDSK",
  "KDDDDDDDDDDDDDDDDDDSK",
  "KKKKKKKKDDDDDDKKKKKKK",
  ".......KDDDDDDK......",
  ".......KDDDDDDK......",
  ".......KDKKKDDK......",
  ".......KDDKDDDK......",
  ".......KDDDDDDK......",
  ".......KSSSSSSK......",
  ".......KKKKKKKK......",
];
// Pressed arms are drawn darker over the pad.
const ARM: Record<Dir, [number, number, number, number]> = {
  up: [8, 1, 6, 6], down: [8, 14, 6, 6], left: [1, 8, 6, 5], right: [14, 8, 6, 5],
};
const PAD_COLORS = { K: MARTY.outline, D: "#2a2530", H: "#4a4352", S: "#1a161f", C: "#14111a", P: "#0d0b10" };

const padCache = new Map<string, Sprite>();
/** The D-pad with the given arms pressed. */
export function dpadSprite(pressed: ReadonlySet<Dir>): Sprite {
  const key = [...pressed].sort().join(",");
  const hit = padCache.get(key);
  if (hit) return hit;
  let g: Grid = grid(DPAD);
  for (const dir of pressed) {
    const [x, y, w, h] = ARM[dir];
    // Only darken pad cells, not the outline or the arrow marks.
    g = g.map((row, yy) => row.map((c, xx) => (c === "D" || c === "H" || c === "S") && yy >= y && yy < y + h && xx >= x && xx < x + w ? "P" : c));
  }
  const s = toSprite(g, PAD_COLORS);
  padCache.set(key, s);
  return s;
}

// 15 x 15 round button. K outline, B face, L highlight, S shade.
const BUTTON = [
  ".....KKKKK.....",
  "...KKBBBBBKK...",
  "..KBLLBBBBBBK..",
  ".KBLLBBBBBBBBK.",
  ".KBLBBBBBBBBBK.",
  "KBBBBBBBBBBBBBK",
  "KBBBBBBBBBBBBBK",
  "KBBBBBBBBBBBBBK",
  "KBBBBBBBBBBBBSK",
  "KBBBBBBBBBBBBSK",
  ".KBBBBBBBBBBSK.",
  ".KSBBBBBBBBSSK.",
  "..KSSBBBBBSSK..",
  "...KKSSSSSKK...",
  ".....KKKKK.....",
];
const BUTTON_COLORS = {
  a: { up: { B: CAMPUS.gold, L: "#fff2b0", S: CAMPUS.goldShade }, down: { B: CAMPUS.goldShade, L: CAMPUS.gold, S: "#8a6418" } },
  b: { up: { B: MARTY.cream, L: "#ffffff", S: MARTY.creamShade }, down: { B: MARTY.creamShade, L: MARTY.cream, S: MARTY.creamDark } },
} as const;

const buttonCache = new Map<string, Sprite>();
export function buttonSprite(which: "a" | "b", pressed: boolean): Sprite {
  const key = `${which}-${pressed}`;
  const hit = buttonCache.get(key);
  if (hit) return hit;
  const s = toSprite(grid(BUTTON), { K: MARTY.outline, ...BUTTON_COLORS[which][pressed ? "down" : "up"] });
  buttonCache.set(key, s);
  return s;
}

/**
 * Which arms of a D-pad a touch point presses, from its offset to the pad's centre as a
 * fraction of the pad's half-width (-1..1). A small dead zone in the middle; diagonals press two.
 */
export function dirsAt(dx: number, dy: number): Set<Dir> {
  const out = new Set<Dir>();
  if (Math.hypot(dx, dy) < 0.2) return out;
  if (dx < -0.3) out.add("left");
  if (dx > 0.3) out.add("right");
  if (dy < -0.3) out.add("up");
  if (dy > 0.3) out.add("down");
  return out;
}
