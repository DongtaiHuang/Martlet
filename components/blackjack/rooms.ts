// Themed rooms for the multiplayer blackjack tables (ADR 0044). Each table is named after a
// campus building, so its room gets that building's look: a pixel wall above the felt, a felt
// colour and a rail. Art only: the game is the same at every table.
// Relative .ts imports keep this importable by node --test.
import { CAMPUS, MARTY } from "../../lib/pixel/palette.ts";
import { blank, grid, spriteSvg, toSprite, type Grid, type Sprite } from "../../lib/pixel/sprite.ts";

export type Room = {
  title: string;
  /** Two felt colours, dithered. */
  felt: [string, string];
  rail: string;
  /** A wall strip (tiles horizontally) shown above the felt. */
  wall: Sprite;
};

const WALL_W = 120;
const WALL_H = 26;

function paint(fill: string) {
  const g = blank(WALL_W, WALL_H).map((row) => row.fill(fill));
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy]?.[xx] !== undefined) g[yy][xx] = c;
  };
  return { g, rect };
}
// A deterministic pseudo-random sequence, so the art is the same on server and browser.
const seq = (seed: number) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

/** Redpath: a library reading room. Oak shelves of books and a green banker's lamp. */
function library(): Grid {
  const { g, rect } = paint("w");
  const rnd = seq(7);
  const spines = ["1", "2", "3", "4", "5"];
  for (const shelfY of [2, 13]) {
    rect(0, shelfY + 9, WALL_W, 2, "o"); // shelf plank
    for (let x = 1; x < WALL_W - 1;) {
      const width = 2 + Math.floor(rnd() * 2);
      const height = 6 + Math.floor(rnd() * 3);
      if (x < 52 || x > 68) rect(x, shelfY + 9 - height, width, height, spines[Math.floor(rnd() * spines.length)]);
      x += width + (rnd() < 0.15 ? 2 : 0);
    }
  }
  // Banker's lamp in the gap.
  rect(56, 23, 8, 2, "b");
  rect(59, 17, 2, 6, "b");
  rect(54, 13, 12, 4, "g");
  rect(55, 12, 10, 1, "G");
  rect(56, 17, 8, 1, "y");
  return g;
}

/** Leacock: an arts building hall. Concrete with event posters and a clock. */
function artsHall(): Grid {
  const { g, rect } = paint("c");
  for (let x = 0; x < WALL_W; x += 30) rect(x, 0, 1, WALL_H, "C"); // panel seams
  rect(0, 22, WALL_W, 4, "C");
  const posters: [number, string, string][] = [[6, "r", "Y"], [38, "B", "W"], [84, "Y", "r"]];
  for (const [x, bg, fg] of posters) {
    rect(x, 3, 16, 17, "K");
    rect(x + 1, 4, 14, 15, bg);
    rect(x + 3, 6, 10, 4, fg);
    rect(x + 3, 12, 8, 1, fg); rect(x + 3, 14, 10, 1, fg); rect(x + 3, 16, 6, 1, fg);
  }
  // Clock.
  rect(64, 4, 10, 10, "K"); rect(65, 5, 8, 8, "W"); rect(68, 6, 1, 3, "K"); rect(69, 8, 2, 1, "K");
  return g;
}

/** Bronfman: the business school. Navy panelling, gold trim and a stock ticker. */
function business(): Grid {
  const { g, rect } = paint("n");
  rect(0, 2, WALL_W, 1, "G"); rect(0, 22, WALL_W, 1, "G");
  rect(0, 7, WALL_W, 10, "K"); // ticker board
  const rnd = seq(42);
  for (let x = 2; x < WALL_W - 2; x += 8) {
    const up = rnd() > 0.4;
    const c = up ? "u" : "d";
    // a tiny arrow and a bar per symbol
    if (up) { rect(x, 9, 1, 1, c); rect(x - 1, 10, 3, 1, c); } else { rect(x - 1, 9, 3, 1, c); rect(x, 10, 1, 1, c); }
    rect(x + 2, 9, 1 + Math.floor(rnd() * 3), 2, c);
    rect(x - 1, 13, 5, 2, "W");
  }
  return g;
}

const ROOMS: Record<string, { title: string; felt: [string, string]; rail: string; draw: () => Grid; colors: Record<string, string> }> = {
  redpath: {
    title: "Redpath Library reading room", felt: ["#1f6b46", "#235f42"], rail: "#3b2416", draw: library,
    colors: { w: "#4a2f1d", o: "#2e1c11", "1": "#a6192e", "2": "#2f5d8a", "3": "#c9962c", "4": "#2e7638", "5": "#efe1c6", b: "#9c7a2c", g: "#1f6b46", G: "#4c9d44", y: "#fff2b0" },
  },
  leacock: {
    title: "Leacock Building hall", felt: ["#7a1f2b", "#6c1b26"], rail: "#55555e", draw: artsHall,
    colors: { c: "#b8b1a3", C: "#9f988b", K: MARTY.outline, r: "#c0263a", Y: CAMPUS.gold, B: "#2f5d8a", W: MARTY.cream },
  },
  bronfman: {
    title: "Bronfman Building trading floor", felt: ["#1d3557", "#1a2f4d"], rail: "#6b4a1f", draw: business,
    colors: { n: "#1b2a44", G: CAMPUS.gold, K: "#0b0f17", u: "#3ad07a", d: "#e0453a", W: "#8fa3c2" },
  },
};

const cache = new Map<string, Room>();

/** The room for a table, or null for tables without one (they keep the plain green table). */
export function roomFor(tableId: string): Room | null {
  const def = ROOMS[tableId];
  if (!def) return null;
  let room = cache.get(tableId);
  if (!room) {
    room = { title: def.title, felt: def.felt, rail: def.rail, wall: toSprite(def.draw(), def.colors) };
    cache.set(tableId, room);
  }
  return room;
}

/** CSS background for a sprite tile, scaled by whole pixels. */
export function tileBackground(sprite: Sprite, scale: number) {
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(spriteSvg(sprite))}")`,
    backgroundSize: `${sprite.w * scale}px ${sprite.h * scale}px`,
    imageRendering: "pixelated" as const,
  };
}

/** A 4 x 4 dithered felt tile in a room's two colours. */
export function feltTile(felt: [string, string]): Sprite {
  return toSprite(grid(["AAAA", "ABAA", "AAAA", "AAAB"]), { A: felt[0], B: felt[1] });
}

export const WALL_SIZE = { w: WALL_W, h: WALL_H };
