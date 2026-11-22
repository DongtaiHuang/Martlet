// Pixel-art nest for the flying martlet, generated in code (deterministic, so the server
// and browser render the same). Two layers so the bird can sit *inside* it: the back rim
// and the dark hollow are drawn behind the bird, the front rim and woven wall in front.
// Lit from the top left: rims catch the light, the wall darkens toward the bottom right.

export const NEST_W = 44;
export const NEST_H = 15;

const COLORS: Record<string, string> = {
  K: "#2a170b", // outline
  A: "#24130a", // hollow, deepest
  B: "#3a2111", // hollow
  C: "#55321a", // inner back wall
  D: "#4a2a13", // twig, darkest
  E: "#6b3f1d", // twig, dark
  F: "#8c5427", // twig, mid
  G: "#b06e33", // twig, light
  H: "#d39a52", // twig, highlight
  S: "#ebc673", // straw
};

// Silhouette of the bowl: [first, last] column per row (rows 0 and 14 are left for the outline).
const ROWS: Record<number, [number, number]> = {
  1: [13, 31], 2: [7, 37], 3: [4, 40], 4: [3, 41], 5: [2, 42], 6: [2, 42],
  7: [3, 41], 8: [3, 41], 9: [4, 40], 10: [5, 39], 11: [8, 36], 12: [11, 33], 13: [16, 28],
};
// Stray twigs poking out of the rim.
const TWIGS: [number, number][] = [[1, 3], [2, 4], [0, 2], [42, 2], [43, 1], [41, 3]];

const CX = 22, CY = 4.3, RX = 15.2, RY = 2.1; // the opening

/** Small deterministic hash in [0, 1). */
function noise(x: number, y: number) {
  let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function inShape(x: number, y: number) {
  const row = ROWS[y];
  return (row && x >= row[0] && x <= row[1]) || TWIGS.some(([tx, ty]) => tx === x && ty === y);
}

function opening(x: number, y: number) {
  return ((x + 0.5 - CX) / RX) ** 2 + ((y + 0.5 - CY) / RY) ** 2;
}

const TONES = ["D", "E", "F", "G", "H"];

function cell(x: number, y: number): { color: string; front: boolean } {
  const n = noise(x, y);
  if (TWIGS.some(([tx, ty]) => tx === x && ty === y)) return { color: n < 0.5 ? "G" : "F", front: y >= CY };
  const inside = opening(x, y);
  if (inside < 1) {
    // Hollow: the far wall is lit, the bottom falls into shadow under the front rim.
    const depth = (y + 0.5 - (CY - RY)) / (2 * RY);
    return { color: depth < 0.3 ? (n < 0.3 ? "E" : "C") : depth < 0.65 ? "B" : "A", front: false };
  }
  const front = y + 0.5 >= CY;
  // Distance below the rim of the opening, in rows (0 = the rim itself).
  const below = front ? y - (CY + RY * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - CX) / RX) ** 2))) : 0;
  let tone: number;
  if (!front) {
    tone = 3.1 - (x - CX) / 20 - (y < 2 ? 0 : 0.4); // back rim: lit top edge
  } else if (below < 1.3) {
    tone = 3.6 - (x - CX) / 18; // front rim: brightest
  } else {
    tone = 2.5 - below * 0.3 - (x - CX) / 13; // wall: darker lower down and to the right
  }
  // Woven twigs: bands that follow the curve of the bowl, crossed by a few diagonal grooves.
  const band = Math.round(y - 2.2 * ((x + 0.5 - CX) / RX) ** 2);
  if (front && below >= 1.3) tone += band % 2 === 0 ? 0.35 : -0.35;
  if ((x * 3 + y * 5) % 11 === 0) tone -= 1.1;
  else if ((x - y * 3 + 60) % 13 === 0) tone += 0.8;
  tone += (n - 0.5) * 0.5;
  const t = Math.max(0, Math.min(4, Math.round(tone)));
  const straw = (!front || below < 1.5) && n > 0.9;
  return { color: straw ? "S" : TONES[t], front };
}

type Layer = Record<string, string[]>;

function build(): { back: Layer; front: Layer } {
  const grid: ({ color: string; front: boolean } | null)[][] = [];
  for (let y = 0; y < NEST_H; y++) {
    grid.push([]);
    for (let x = 0; x < NEST_W; x++) grid[y].push(inShape(x, y) ? cell(x, y) : null);
  }
  // Outline every empty cell next to the nest; it belongs to the layer it touches.
  const out = grid.map((row) => [...row]);
  for (let y = 0; y < NEST_H; y++)
    for (let x = 0; x < NEST_W; x++) {
      if (grid[y][x]) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => grid[y + dy]?.[x + dx]).filter(Boolean);
      if (near.length) out[y][x] = { color: "K", front: near.some((c) => c!.front) };
    }
  // Run-length encode each layer into one path per colour.
  const layers = { back: {} as Layer, front: {} as Layer };
  out.forEach((row, y) => {
    let x = 0;
    while (x < NEST_W) {
      const c = row[x];
      let n = 1;
      while (x + n < NEST_W && row[x + n]?.color === c?.color && row[x + n]?.front === c?.front) n++;
      if (c) (layers[c.front ? "front" : "back"][c.color] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  return layers;
}

const LAYERS = build();

/** `{ fill, d }` paths for one layer, in a fixed order. */
export function nestPaths(layer: "back" | "front") {
  return Object.keys(COLORS)
    .filter((c) => LAYERS[layer][c])
    .map((c) => ({ fill: COLORS[c], d: LAYERS[layer][c].join("") }));
}
