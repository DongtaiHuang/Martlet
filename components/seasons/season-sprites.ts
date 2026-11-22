// Pixel-art sprites for the seasonal themes (components/seasons/SeasonalScene.tsx), generated
// in code like Marty and his nest. Deterministic, so server and browser agree. Each sprite is
// a grid of colour letters turned into one SVG <path> per colour.

type Grid = string[][];
export type Sprite = { w: number; h: number; paths: { fill: string; d: string }[] };

function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array(w).fill("."));
}

/** Outline every empty cell that touches a filled one (4-neighbours) with `outline`. */
function outlined(g: Grid, outline: string): Grid {
  const out = g.map((row) => [...row]);
  g.forEach((row, y) => row.forEach((c, x) => {
    if (c !== ".") return;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = g[y + dy]?.[x + dx]; return n !== undefined && n !== "." && n !== outline; })) out[y][x] = outline;
  }));
  return out;
}

function toSprite(g: Grid, colors: Record<string, string>): Sprite {
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
  return { w: g[0].length, h: g.length, paths: Object.keys(colors).filter((c) => runs[c]).map((c) => ({ fill: colors[c], d: runs[c].join("") })) };
}

// ---- Leaves -------------------------------------------------------------------------------
// Two shapes (maple and oval), four autumn colours. O = leaf, D = shade, S = vein/stem, K = outline.
const MAPLE = [
  "....O....",
  "...OOO...",
  ".O.OOO.O.",
  "OOOOSOOOO",
  ".OOOSOOO.",
  "..OOSOD..",
  ".OODSDDO.",
  "....S....",
  "....S....",
];
const OVAL = [
  "...OO..",
  "..OOOO.",
  ".OOSOOD",
  ".OOSODD",
  "OOSODD.",
  "OSDDD..",
  "S......",
];
const LEAF_COLORS = [
  { O: "#e8742a", D: "#b9531a", S: "#7a3410" }, // orange
  { O: "#c9431f", D: "#932c13", S: "#5e1c0c" }, // rust red
  { O: "#e7b236", D: "#b9841d", S: "#7a5410" }, // gold
  { O: "#9a5a2c", D: "#6f3d1b", S: "#462410" }, // brown
];
const LEAF_OUTLINE = "#3a1d0b";

export const LEAVES: Sprite[] = [MAPLE, OVAL].flatMap((shape) =>
  LEAF_COLORS.map((c) => toSprite(outlined(shape.map((r) => [...r]), "K"), { K: LEAF_OUTLINE, ...c })),
);

// ---- Snowman --------------------------------------------------------------------------------
// Builds up in stages: 0 mound, 1 base, 2 body, 3 head, 4 dressed (face, hat, scarf, arms).
const SNOW = { W: "#f6f9fd", S: "#c6d8ea", K: "#4a6584", C: "#1f2933", N: "#ef7d2b", R: "#c2332b", H: "#23262d", B: "#7a4a24" };
const SW = 19, SH = 26;

/** Draw a snowball over whatever is below it, with a dark seam where it sits on another ball. */
function disc(g: Grid, owner: number[][], id: number, cx: number, cy: number, r: number) {
  const inside = (x: number, y: number) => { const dx = x + 0.5 - cx, dy = y + 0.5 - cy; return dx * dx + dy * dy <= r * r; };
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (!inside(x, y)) continue;
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    // Seam: the ball's lower edge, where the cell just below belongs to an earlier ball.
    const seam = !inside(x, y + 1) && owner[y + 1]?.[x] > 0 && owner[y + 1][x] !== id;
    g[y][x] = seam ? "K" : dx + dy * 0.6 > r * 0.45 ? "S" : "W"; // shade lower right
    owner[y][x] = id;
  }
}

function snowman(stage: number): Sprite {
  const g = blank(SW, SH);
  const owner = Array.from({ length: SH }, () => Array(SW).fill(0));
  // Mound of snow at the bottom (always there).
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const dx = (x + 0.5 - 9.5) / 8.5, dy = (y + 0.5 - 25) / 2.6;
    if (dx * dx + dy * dy <= 1) g[y][x] = dy > 0.1 || dx > 0.55 ? "S" : "W";
  }
  if (stage >= 1) disc(g, owner, 1, 9.5, 19.5, 5.3);
  if (stage >= 2) disc(g, owner, 2, 9.5, 12.6, 4.1);
  if (stage >= 3) disc(g, owner, 3, 9.5, 7, 3.2);
  let out = outlined(g, "K");
  if (stage >= 4) {
    const set = (x: number, y: number, c: string) => { if (out[y]?.[x] !== undefined) out[y][x] = c; };
    // Coal eyes, carrot nose, coal buttons.
    set(8, 6, "C"); set(10, 6, "C");
    set(10, 7, "N"); set(11, 7, "N"); set(12, 7, "N");
    set(9, 12, "C"); set(9, 14, "C"); set(9, 18, "C");
    // Scarf with a hanging tail.
    for (let x = 6; x <= 12; x++) set(x, 9, "R");
    set(11, 10, "R"); set(11, 11, "R"); set(12, 11, "R");
    // Stick arms.
    [[5, 12], [4, 11], [3, 10], [2, 9], [3, 9]].forEach(([x, y]) => set(x, y, "B"));
    [[14, 12], [15, 11], [16, 10], [17, 9], [16, 9]].forEach(([x, y]) => set(x, y, "B"));
    // Top hat with a red band.
    for (let x = 6; x <= 12; x++) set(x, 3, "H");
    for (let y = 0; y <= 2; y++) for (let x = 7; x <= 11; x++) set(x, y, y === 2 ? "R" : "H");
    out = out.map((row) => [...row]);
  }
  return toSprite(out, SNOW);
}

export const SNOWMAN_STAGES: Sprite[] = [0, 1, 2, 3, 4].map(snowman);
export const SNOWMAN_FULL = SNOWMAN_STAGES.length - 1;

// ---- Snow mound -----------------------------------------------------------------------------
// The fluffy drift Marty burrows into in Winter: overlapping puffs of snow, like a cloud sitting
// on the ground. Each puff gets a soft seam where it overlaps the one behind it.
const MOUND = { W: "#f6f9fd", H: "#ffffff", S: "#d3e2f0", L: "#a9c3dd", K: "#4a6584" };
const MW = 34, MH = 22;
// [cx, cy, r], drawn back to front.
const PUFFS: [number, number, number][] = [
  [12, 9, 5.5], [21, 8, 6], [28, 12, 5], [6, 13, 5], [16, 14, 6.5], [25, 17, 6], [9, 18, 6], [30, 19, 4.5], [3, 19, 3.5],
];

function snowMound(): Sprite {
  const g = blank(MW, MH);
  const owner = Array.from({ length: MH }, () => Array(MW).fill(-1));
  // A solid base of snow along the ground, so there are no gaps between the bottom puffs.
  for (let y = MH - 4; y < MH; y++) for (let x = 1; x < MW - 1; x++) g[y][x] = x > MW * 0.6 ? "S" : "W";
  PUFFS.forEach(([cx, cy, r], id) => {
    const inside = (x: number, y: number) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!inside(x, y)) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      // A seam where this puff's edge sits over an earlier puff.
      const seam = [[0, -1], [-1, 0], [1, 0]].some(([ox, oy]) => !inside(x + ox, y + oy) && owner[y + oy]?.[x + ox] >= 0);
      g[y][x] = seam ? "L" : dy < -r * 0.55 && dx < r * 0.2 ? "H" : dx + dy > r * 0.55 ? "S" : "W";
      owner[y][x] = id;
    }
  });
  return toSprite(outlined(g, "K"), MOUND);
}

export const SNOW_MOUND = snowMound();

// ---- Summer: rubber duck, water and sand ------------------------------------------------------
// D = duck yellow, d = shade, B = beak, E = eye, H = highlight, K = outline.
const DUCK_ROWS = [
  "....DDD.......",
  "...DDDDD......",
  "...DHEDDBB....",
  "...DDDDDBBB...",
  "....DDDD......",
  ".DDDDDDDDDD...",
  "DDDDDDDDDDDD..",
  "DDHDDDDDDDDd..",
  "DDDDDDDDDDdd..",
  ".dDDDDDDDddd..",
  "..ddddddddd...",
];
// Padded by one pixel all round so the outline fits.
const padded = (rows: string[]) => [".".repeat(rows[0].length + 2), ...rows.map((r) => `.${r}.`), ".".repeat(rows[0].length + 2)];
export const DUCK = toSprite(outlined(padded(DUCK_ROWS).map((r) => [...r]), "K"), {
  K: "#5a3a12", D: "#ffd23f", d: "#e8a51e", B: "#f07a22", E: "#1f2933", H: "#fff6c8",
});

// The water Marty splashes into: a wave-topped swell, foam along the top, darker below.
const POOL = { F: "#ffffff", A: "#8fd8ea", B: "#4fb3d1", C: "#2f8fb3", S: "#c9f1fa", K: "#1f5f7a" };
function waterPool(): Sprite {
  const w = 34, h = 22;
  const g = blank(w, h);
  for (let x = 1; x < w - 1; x++) {
    // A dome with little wave crests along its top.
    const dome = 3 + Math.round(((x - w / 2) / (w / 2)) ** 2 * 7);
    const top = dome + (x % 4 === 0 ? 1 : x % 4 === 2 ? -1 : 0);
    for (let y = Math.max(1, top); y < h; y++) {
      const depth = y - top;
      g[y][x] = depth === 0 ? "F" : depth < 3 ? "A" : depth < 9 ? "B" : "C";
      if (depth === 2 && x % 7 === 3) g[y][x] = "S"; // glints
    }
  }
  return toSprite(outlined(g, "K"), POOL);
}
export const WATER_POOL = waterPool();

/** A repeating tile as a CSS url(), for background strips (sand, water). */
function tile(rows: string[], colors: Record<string, string>) {
  const s = toSprite(rows.map((r) => [...r]), colors);
  const body = s.paths.map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join("");
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}" shape-rendering="crispEdges">${body}</svg>`)}")`;
}
// 16x8 pixel water: foam crests on top, three bands of blue.
export const WATER_TILE = tile([
  "..FF......FF....",
  ".FAAF....FAAF...",
  "FAAAAFFFFAAAAFFF",
  "AAAAAAAAAAAAAAAA",
  "BBBABBBBBBBABBBB",
  "BBBBBBBBBBBBBBBB",
  "CCBCCCCCCCBCCCCC",
  "CCCCCCCCCCCCCCCC",
], { F: "#ffffff", A: "#8fd8ea", B: "#4fb3d1", C: "#2f8fb3" });
// 12x8 pixel sand with a few pebbles and shells.
export const SAND_TILE = tile([
  "SSSSSSSSSSSS",
  "SSSdSSSSSSSS",
  "SSSSSSSSSoSS",
  "SdSSSSSSSSSS",
  "SSSSSSdSSSSS",
  "SSSSSSSSSSSd",
  "SSSoSSSSSSSS",
  "SSSSSSSSdSSS",
], { S: "#f1d9a3", d: "#d9b877", o: "#fff3dc" });

// ---- Chinese New Year: lantern, goat, red pocket, gold coin ------------------------------------
const CNY = { K: "#4a0d0d", R: "#d7262e", r: "#a3161c", G: "#f5c84c", g: "#c9962a", W: "#fff1d0", T: "#e2a72c" };
// Palace lantern: gold caps and frame, red body with little plum-blossom flowers, a tassel.
// (W = blossom, Y = blossom centre.)
const LANTERN_ROWS = [
  ".....g.....",
  ".....g.....",
  "..GGGGGGG..",
  "..ggggggg..",
  ".RRRRRRRRr.",
  "RRWWRRRRRrr",
  "RWYWRRWWRrr",
  "RRWWRRWYWrr",
  "RRRRRRRWWrr",
  "RWWRRRRRRrr",
  "WYWRRWWRRrr",
  "RWWRRWYWRrr",
  ".RRRRRWWRr.",
  "..GGGGGGG..",
  "..ggggggg..",
  ".....T.....",
  "....TTT....",
  "....TTT....",
  "....T.T....",
];
export const LANTERN = toSprite(outlined(padded(LANTERN_ROWS).map((r) => [...r]), "K"), { ...CNY, W: "#ffd9e2", Y: "#f5c84c" });

// A red scroll with gold rollers and a gold 福 ("good fortune"), the classic New Year greeting.
const FU_GLYPH = [
  "..G.........",
  "GGGG.GGGGGGG",
  "...G........",
  "..G...GGGGG.",
  ".GGG..G...G.",
  "G.G.G.GGGGG.",
  "..G..GGGGGGG",
  "..G..G..G..G",
  "..G..GGGGGGG",
  "..G..G..G..G",
  "..G..GGGGGGG",
];
function fuScroll(): Sprite {
  const w = 18, h = 21;
  const g = blank(w, h);
  const roller = (y: number) => {
    for (let x = 0; x < w; x++) g[y][x] = x < 2 || x > w - 3 ? "G" : "r";
    for (let x = 2; x < w - 2; x++) g[y + 1][x] = "R";
  };
  roller(0);
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) g[y][x] = x === 2 || x === w - 3 || y === 2 || y === h - 3 ? "g" : "R";
  roller(h - 2);
  FU_GLYPH.forEach((row, y) => [...row].forEach((c, x) => { if (c === "G") g[y + 5][x + 3] = "G"; }));
  return toSprite(outlined(padded(g.map((r) => r.join(""))).map((r) => [...r]), "K"), CNY);
}
export const FU_SCROLL = fuScroll();

// A string of red firecrackers with gold bands on a cord.
const FIRECRACKER_ROWS = [
  "...c...",
  "...c...",
  ".RRcRR.",
  ".GGcGG.",
  ".RRcRr.",
  ".RRcRr.",
  ".GGcGG.",
  ".RRcRR.",
  ".GGcGG.",
  ".RRcRr.",
  ".RRcRr.",
  ".GGcGG.",
  ".RRcRR.",
  ".GGcGG.",
  ".RRcRr.",
  "...c...",
  "..T.T..",
];
export const FIRECRACKERS = toSprite(outlined(padded(FIRECRACKER_ROWS).map((r) => [...r]), "K"), { ...CNY, c: "#7a4d0c" });

// A mandarin orange with a green leaf (oranges for luck).
const ORANGE_ROWS = [
  "....LL..",
  "...nLLL.",
  "..OOnOO.",
  ".OHOOOOo",
  "OHOOOOOo",
  "OOOOOOOo",
  "OOOOOOoo",
  ".OOOOoo.",
  "..oooo..",
];
export const MANDARIN = toSprite(outlined(padded(ORANGE_ROWS).map((r) => [...r]), "K"), {
  K: "#6b2a08", O: "#ff8a1f", o: "#d9620e", H: "#ffd29a", L: "#3fa34d", n: "#2a6b33",
});

// A four-point gold sparkle for the background.
const SPARKLE_ROWS = [
  "..G..",
  "..G..",
  "GGWGG",
  "..G..",
  "..G..",
];
export const SPARKLE = toSprite(SPARKLE_ROWS.map((r) => [...r]), { G: "#f5c84c", W: "#fff6d8" });

// A cute goat (2027 is the Year of the Goat): cream wool, curled horns, little beard.
const GOAT_ROWS = [
  "..........hh..",
  ".........h..h.",
  "........hWWh..",
  "........WWEW..",
  "........WWWWn.",
  ".WWWWWWWWWWb..",
  "WWWWWWWWWWW...",
  "WWwWWWWWWWw...",
  ".WWWWWWWWww...",
  ".L.L...L.L....",
  ".L.L...L.L....",
];
export const GOAT = toSprite(outlined(padded(GOAT_ROWS).map((r) => [...r]), "K"), {
  K: "#5b4636", W: "#fbf3e4", w: "#e6d6bd", h: "#b98a3e", E: "#2a1f17", n: "#e9a5a0", b: "#d8c8ad", L: "#7a5b3f",
});

// Red pocket (hongbao) with a gold medallion.
const POCKET_ROWS = [
  "RRRRRRRR",
  "RrRRRRrR",
  "RRrrrrRR",
  "RRRGGRRR",
  "RRGWWGRR",
  "RRGWWGRR",
  "RRRGGRRR",
  "RRRRRRRR",
  "RRRRRRRr",
  "rRRRRRrr",
];
export const RED_POCKET = toSprite(outlined(padded(POCKET_ROWS).map((r) => [...r]), "K"), CNY);

// Gold coin with a square hole.
const COIN_ROWS = [
  ".GGGG.",
  "GGWGGg",
  "GG..Gg",
  "GG..Gg",
  "GGGGgg",
  ".gggg.",
];
export const COIN = toSprite(outlined(padded(COIN_ROWS).map((r) => [...r]), "K"), { ...CNY, K: "#7a4d0c" });

// Gold key-pattern (回纹) border, for the strips down both sides of the screen.
export const FRET_TILE = tile([
  "GGGGGGGGGG",
  "G........G",
  "G.GGGGGG.G",
  "G.G....G.G",
  "G.G.GG.G.G",
  "G.G.G..G.G",
  "G.G.GGGG.G",
  "G.G......G",
  "G.GGGGGGGG",
  "G.........",
], { G: "#e2b545" });
