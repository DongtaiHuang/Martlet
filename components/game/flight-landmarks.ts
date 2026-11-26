// McGill landmarks in pixel art for Martlet Flight's skyline (ADR 0044): the Roddick Gates, the
// Arts Building, Redpath Museum and Redpath Hall, plus campus trees and a 3x5 capital-letter
// font for their names. Drawn with simple shapes into letter grids, in day and night colours.
// Relative .ts imports keep this importable by node --test.
import { CAMPUS, MARTY } from "../../lib/pixel/palette.ts";
import { blank, outlined, toSprite, type Grid, type Sprite } from "../../lib/pixel/sprite.ts";

type Mode = "light" | "dark";

// S stone, s stone shade, C column, W window, D doorway, R roof/dome, r roof shade, I iron,
// L lantern, B tree leaf, b leaf shade, T trunk, K outline.
const COLORS: Record<Mode, Record<string, string>> = {
  light: {
    K: MARTY.outline, S: CAMPUS.stone, s: CAMPUS.stoneShade, C: "#fff6e3", W: CAMPUS.window, D: "#4a2a20",
    R: "#6e9c8c", r: "#4f7a6b", I: "#2a2a30", L: CAMPUS.gold, B: CAMPUS.leaf, b: CAMPUS.leafDark, T: CAMPUS.wood,
  },
  dark: {
    K: "#14101c", S: "#3a3550", s: "#2c2840", C: "#4a4562", W: "#ffd36b", D: "#1a1426",
    R: "#2f4a4a", r: "#223838", I: "#0f0f14", L: "#ffe39a", B: "#1e3a28", b: "#142a1d", T: "#2a1d14",
  },
};

class Painter {
  g: Grid;
  constructor(w: number, h: number) { this.g = blank(w, h); }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.g[yy]?.[xx] !== undefined) this.g[yy][xx] = c;
    return this;
  }
  /** A filled triangle (pediment or roof) with its base on row `base`. */
  gable(x: number, base: number, w: number, h: number, c: string) {
    for (let r = 0; r < h; r++) { const inset = Math.round(((h - r) / h) * (w / 2)); this.rect(x + inset, base - h + r, Math.max(1, w - inset * 2), 1, c); }
    return this;
  }
  /** A half-disc dome sitting on row `base`. */
  dome(cx: number, base: number, radius: number, c: string, shade: string) {
    for (let r = 0; r < radius; r++) {
      const half = Math.round(Math.sqrt(radius * radius - (radius - r) * (radius - r)));
      this.rect(cx - half, base - radius + r, half * 2, 1, c);
      this.rect(cx + Math.max(0, half - 2), base - radius + r, Math.min(2, half), 1, shade);
    }
    return this;
  }
  windows(x0: number, x1: number, y: number, every: number, w: number, h: number) {
    for (let x = x0; x + w <= x1; x += every) this.rect(x, y, w, h, "W");
    return this;
  }
}

function roddickGates(): Grid {
  const p = new Painter(66, 42);
  p.rect(0, 28, 7, 14, "S").rect(59, 28, 7, 14, "S"); // low side walls
  for (const x of [7, 49]) {
    p.rect(x, 8, 10, 34, "S").rect(x + 7, 8, 3, 34, "s"); // pillars
    p.rect(x - 1, 6, 12, 3, "s").rect(x + 3, 2, 4, 4, "L").rect(x + 4, 1, 2, 1, "I"); // caps and lanterns
  }
  // Outline the stonework, then add the ironwork so the gaps between bars stay open.
  p.g = outlined(p.g, "K");
  for (let x = 17; x < 49; x++) { // iron arch over the gateway
    const t = (x - 33) / 16;
    p.rect(x, Math.round(12 + 6 * t * t), 1, 2, "I");
  }
  for (let x = 19; x < 48; x += 3) p.rect(x, 18 - (Math.abs(x - 33) < 9 ? 3 : 0), 1, 24, "I"); // bars
  return p.g;
}

function artsBuilding(): Grid {
  const p = new Painter(92, 58);
  p.rect(0, 22, 92, 36, "S").rect(84, 22, 8, 36, "s"); // wings
  p.rect(0, 20, 92, 2, "s");
  p.windows(4, 32, 27, 7, 3, 6).windows(60, 88, 27, 7, 3, 6).windows(4, 32, 41, 7, 3, 6).windows(60, 88, 41, 7, 3, 6);
  p.rect(32, 18, 28, 4, "s").gable(32, 18, 28, 7, "S"); // portico pediment
  for (const x of [34, 41, 48, 55]) p.rect(x, 22, 3, 30, "C");
  p.rect(43, 40, 6, 12, "D"); // door
  p.rect(30, 52, 32, 6, "s"); // steps
  p.rect(40, 5, 12, 6, "S").windows(42, 51, 7, 3, 1, 2); // cupola drum
  p.dome(46, 5, 6, "R", "r");
  p.rect(45, -1, 2, 1, "L");
  return outlined(p.g, "K");
}

function redpathMuseum(): Grid {
  const p = new Painter(78, 48);
  p.rect(6, 18, 66, 22, "s"); // wall behind the columns
  p.rect(2, 15, 74, 3, "S"); // entablature
  p.gable(2, 15, 74, 11, "S");
  p.rect(32, 8, 14, 2, "s"); // tympanum detail
  for (let x = 8; x <= 66; x += 10) p.rect(x, 18, 4, 22, "C");
  p.rect(35, 28, 8, 12, "D");
  p.rect(0, 40, 78, 3, "S").rect(2, 43, 74, 5, "s"); // base and steps
  return outlined(p.g, "K");
}

function redpathHall(): Grid {
  const p = new Painter(72, 60);
  p.rect(0, 26, 54, 34, "S").rect(50, 26, 4, 34, "s");
  p.gable(0, 26, 54, 14, "r");
  for (let x = 5; x < 48; x += 9) { p.rect(x, 33, 4, 14, "W"); p.rect(x + 1, 31, 2, 2, "W"); } // tall pointed windows
  p.rect(22, 48, 8, 12, "D");
  p.rect(54, 4, 14, 56, "S").rect(64, 4, 4, 56, "s"); // tower
  for (let x = 54; x < 68; x += 4) p.rect(x, 1, 2, 3, "S"); // battlements
  p.rect(58, 12, 4, 8, "W").rect(58, 28, 4, 8, "W").rect(58, 44, 4, 8, "W");
  return outlined(p.g, "K");
}

function tree(): Grid {
  const p = new Painter(16, 22);
  p.rect(7, 14, 2, 8, "T");
  p.rect(3, 2, 10, 12, "B").rect(1, 5, 14, 7, "B").rect(5, 0, 6, 2, "B");
  p.rect(9, 3, 4, 10, "b").rect(13, 6, 2, 5, "b");
  return outlined(p.g, "K");
}

export const LANDMARKS = [
  { name: "RODDICK GATES", draw: roddickGates },
  { name: "ARTS BUILDING", draw: artsBuilding },
  { name: "REDPATH MUSEUM", draw: redpathMuseum },
  { name: "REDPATH HALL", draw: redpathHall },
] as const;

const cache = new Map<string, Sprite>();
const cached = (key: string, make: () => Sprite) => { let s = cache.get(key); if (!s) { s = make(); cache.set(key, s); } return s; };

export const landmarkSprite = (index: number, mode: Mode) =>
  cached(`lm-${index}-${mode}`, () => toSprite(LANDMARKS[index].draw(), COLORS[mode]));
export const treeSprite = (mode: Mode) => cached(`tree-${mode}`, () => toSprite(tree(), COLORS[mode]));

// 3 x 5 capitals for landmark names.
const LETTERS: Record<string, string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], B: ["##.", "#.#", "##.", "#.#", "##."], C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."], E: ["###", "#..", "##.", "#..", "###"], F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"], H: ["#.#", "#.#", "###", "#.#", "#.#"], I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."], K: ["#.#", "##.", "#..", "##.", "#.#"], L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"], N: ["##.", "#.#", "#.#", "#.#", "#.#"], O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."], Q: [".#.", "#.#", "#.#", "##.", ".##"], R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."], T: ["###", ".#.", ".#.", ".#.", ".#."], U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."], W: ["#.#", "#.#", "###", "###", "#.#"], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."], Z: ["###", "..#", ".#.", "#..", "###"], " ": ["...", "...", "...", "...", "..."],
};

/** A name in the 3x5 font on a dark plate, for the landmark coming into view. */
export function labelSprite(text: string): Sprite {
  return cached(`label-${text}`, () => {
    const chars = [...text.toUpperCase()].map((c) => LETTERS[c] ?? LETTERS[" "]);
    const width = chars.length * 4 + 3;
    const g = blank(width, 9);
    for (let y = 0; y < 9; y++) for (let x = 0; x < width; x++) g[y][x] = y === 0 || y === 8 || x === 0 || x === width - 1 ? "K" : "P";
    chars.forEach((rows, i) => rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === "#") g[y + 2][2 + i * 4 + x] = "W"; })));
    return toSprite(g, { K: MARTY.outline, P: "#3a1a24", W: MARTY.cream });
  });
}
