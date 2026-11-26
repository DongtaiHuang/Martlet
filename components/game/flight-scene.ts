// Martlet Flight's pixel-art scene (ADR 0044). Everything is drawn on a small "art" canvas, one
// canvas pixel per art pixel (ART game units each), then scaled up with smoothing off, so the
// game matches Marty, the landmark towers and the progress tree. Game logic stays in game units.
import { CAMPUS, MARTY, SKY } from "@/lib/pixel/palette";
import { drawSprite } from "@/lib/pixel/sprite";
import { BIRD_OFFSET, BIRD_PAD, CLOUD, MOON, PIN, birdFrames, numberSprite, type Wing } from "./flight-sprites";
import { LANDMARKS, labelSprite, landmarkSprite, treeSprite } from "./flight-landmarks";

export const ART = 2;
/** Skyline scroll speed relative to the columns (parallax). */
export const SKYLINE_PARALLAX = 0.3;

export type SceneState = {
  mode: "light" | "dark";
  W: number; H: number; GROUND: number; COL_W: number;
  t: number; distance: number;
  cols: { x: number; gapY: number; gap: number; pin: { y: number; taken: boolean } | null }[];
  bird: { x: number; y: number; wing: Wing };
  look: { plumage: { id: string; body: string; wing: string }; wearing: readonly string[] };
  score: number | null;
};

const a = (v: number) => Math.round(v / ART);

const SCENE = {
  light: { mountain: "#8fb0cd", mountainTop: "#a7c3dc", cross: CAMPUS.white, city: CAMPUS.stone, cityShade: CAMPUS.stoneShade, window: CAMPUS.window, halo: null },
  dark: { mountain: "#1e2b3a", mountainTop: "#26364a", cross: "#ffe9a8", city: "#2a2640", cityShade: "#1f1c31", window: "#ffd36b", halo: "#33386a" },
} as const;

// Static layers are drawn once per size and mode, then copied every frame.
const layerCache = new Map<string, HTMLCanvasElement>();
function layer(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  let c = layerCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    paint(g);
    layerCache.set(key, c);
  }
  return c;
}

/** Sky in bands, with a checkerboard dither where two bands meet. */
function sky(mode: "light" | "dark", w: number, h: number) {
  return layer(`sky-${mode}-${w}x${h}`, w, h, (g) => {
    const bands = SKY[mode === "dark" ? "night" : "day"];
    const band = Math.ceil(h / bands.length);
    bands.forEach((color, i) => { g.fillStyle = color; g.fillRect(0, i * band, w, band); });
    for (let i = 1; i < bands.length; i++) {
      g.fillStyle = bands[i];
      for (let y = i * band - 2; y < i * band; y++) for (let x = (y % 2); x < w; x += 2) g.fillRect(x, y, 1, 1);
    }
  });
}

/** Mount Royal: a stepped pixel silhouette with the cross; 300 art pixels wide, tiles. */
function mountain(mode: "light" | "dark") {
  const s = SCENE[mode];
  return layer(`mountain-${mode}`, 300, 90, (g) => {
    for (let x = 0; x < 300; x++) {
      const u = x / 300;
      const top = Math.round(90 - (18 + 62 * Math.pow(Math.sin(Math.PI * u), 1.6) + 4 * Math.sin(u * 23)));
      g.fillStyle = s.mountainTop; g.fillRect(x, top, 1, 2);
      g.fillStyle = s.mountain; g.fillRect(x, top + 2, 1, 90 - top - 2);
    }
    g.fillStyle = s.cross; g.fillRect(149, 2, 2, 14); g.fillRect(145, 6, 10, 2);
  });
}

/** Real McGill landmarks scroll past in turn, with trees between them (ADR 0044). */
export const LANDMARK_SPACING = 170; // art pixels from one landmark to the next

/** Draws the skyline and returns a function that draws the name plate (after the ground). */
function skyline(g: CanvasRenderingContext2D, s: SceneState, w: number, groundY: number): () => void {
  const scroll = Math.floor((s.distance * SKYLINE_PARALLAX) / ART);
  const n = LANDMARKS.length;
  const tree = treeSprite(s.mode);
  let featured: { index: number; centre: number } | null = null;
  for (let k = Math.floor(scroll / LANDMARK_SPACING) - 1; k * LANDMARK_SPACING - scroll < w; k++) {
    const index = ((k % n) + n) % n;
    const sprite = landmarkSprite(index, s.mode);
    const x = k * LANDMARK_SPACING - scroll;
    drawSprite(g, tree, x + sprite.w + 14, groundY - tree.h);
    drawSprite(g, tree, x + sprite.w + 38, groundY - tree.h + 3);
    drawSprite(g, sprite, x, groundY - sprite.h);
    const centre = x + sprite.w / 2;
    if (centre > w * 0.1 && centre < w * 0.9 && (!featured || Math.abs(centre - w / 2) < Math.abs(featured.centre - w / 2))) featured = { index, centre };
  }
  // The name of the landmark in view, on a plate over the brick path below it.
  const shown = featured;
  return () => {
    if (!shown) return;
    const label = labelSprite(LANDMARKS[shown.index].name);
    const lx = Math.min(w - label.w - 2, Math.max(2, Math.round(shown.centre - label.w / 2)));
    drawSprite(g, label, lx, groundY + 12);
  };
}

/** A fluted stone column with a red McGill banner; `capAtBottom` for the hanging top half. */
function column(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, capAtBottom: boolean) {
  if (y1 <= y0) return;
  g.fillStyle = MARTY.outline; g.fillRect(x - 1, y0, w + 2, y1 - y0);
  g.fillStyle = CAMPUS.stone; g.fillRect(x, y0, w, y1 - y0);
  g.fillStyle = CAMPUS.stoneShade; g.fillRect(x + w - 5, y0, 5, y1 - y0);
  for (let s = x + 4; s < x + w - 6; s += 5) g.fillRect(s, y0, 1, y1 - y0); // fluting
  const capY = capAtBottom ? y1 - 7 : y0;
  g.fillStyle = MARTY.outline; g.fillRect(x - 4, capY - 1, w + 8, 9);
  g.fillStyle = CAMPUS.stoneShade; g.fillRect(x - 3, capY, w + 6, 7);
  g.fillStyle = CAMPUS.stone; g.fillRect(x - 3, capY, w + 6, 2);
  // Banner under the capital (top half) or above it (bottom half).
  const by = capAtBottom ? capY - 11 : capY + 8;
  g.fillStyle = MARTY.outline; g.fillRect(x + 3, by - (capAtBottom ? 0 : 0), w - 9, 11);
  g.fillStyle = "#a6192e"; g.fillRect(x + 4, by, w - 11, 10);
  g.fillStyle = CAMPUS.white; g.fillRect(x + 4, capAtBottom ? by : by + 8, w - 11, 2);
}

export function drawScene(g: CanvasRenderingContext2D, s: SceneState) {
  const w = a(s.W), h = a(s.H), groundY = a(s.H - s.GROUND), dark = s.mode === "dark";
  g.imageSmoothingEnabled = false;
  g.drawImage(sky(s.mode, w, h), 0, 0);

  if (dark) {
    for (let i = 0; i < 40; i++) {
      if (Math.sin(s.t * 2 + i) < -0.6) continue; // twinkle by blinking off
      const sx = (((i * 97) % w) - Math.floor(s.distance * 0.01) + w * 4) % w;
      g.fillStyle = i % 5 ? "#c9d4ff" : CAMPUS.white; g.fillRect(sx, (i * 53) % Math.floor(h * 0.5), 1, 1);
    }
    drawSprite(g, MOON, w - 34, 26);
  } else {
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 83 - Math.floor(s.distance * 0.04)) % (w + 40) + w + 40) % (w + 40) - 20;
      drawSprite(g, CLOUD, cx, 18 + i * 22);
    }
  }

  // Parallax layers, tiled.
  const tile = (img: HTMLCanvasElement, speed: number, y: number) => {
    const off = -(Math.floor(s.distance * speed / ART) % img.width);
    for (let x = off; x < w; x += img.width) g.drawImage(img, x, y);
  };
  const m = mountain(s.mode); tile(m, 0.08, groundY - m.height + 4);

  const drawLandmarkName = skyline(g, s, w, groundY);

  // Columns and pins.
  const colW = a(s.COL_W);
  for (const col of s.cols) {
    const x = a(col.x);
    column(g, x, -2, a(col.gapY - col.gap / 2), colW, true);
    column(g, x, a(col.gapY + col.gap / 2), groundY + 2, colW, false);
    if (col.pin && !col.pin.taken) {
      const bob = Math.round(Math.sin(s.t * 4 + col.x) * 2);
      drawSprite(g, PIN, x + Math.floor(colW / 2) - 3, a(col.pin.y) - 5 + bob);
    }
  }

  // Ground: grass with blades, then a scrolling brick path.
  g.fillStyle = MARTY.outline; g.fillRect(0, groundY - 1, w, 1);
  g.fillStyle = dark ? "#2f4a2a" : CAMPUS.grass; g.fillRect(0, groundY, w, 8);
  g.fillStyle = dark ? "#3c5a33" : CAMPUS.grassLight;
  const scroll = Math.floor(s.distance / ART);
  for (let x = -(scroll % 6); x < w; x += 6) { g.fillRect(x, groundY, 2, 1); g.fillRect(x + 3, groundY + 2, 1, 2); }
  g.fillStyle = dark ? "#5a4636" : CAMPUS.path; g.fillRect(0, groundY + 8, w, h - groundY - 8);
  g.fillStyle = dark ? "#4a3829" : CAMPUS.pathShade;
  for (let row = 0; row < 4; row++) {
    const y = groundY + 10 + row * 7;
    g.fillRect(0, y + 6, w, 1);
    for (let x = -(scroll % 14) + (row % 2) * 7; x < w; x += 14) g.fillRect(x, y, 1, 6);
  }

  drawLandmarkName();

  // Marty (the student's look).
  const bx = a(s.bird.x), by = a(s.bird.y);
  if (dark) { // a soft pixel halo so a dark plumage reads against the night sky
    g.fillStyle = SCENE.dark.halo;
    for (let r = -12; r <= 12; r++) { const half = Math.round(Math.sqrt(144 - r * r) * 1.3); if ((r + by) % 2 === 0 || Math.abs(r) < 9) g.fillRect(bx - half, by + r, half * 2, 1); }
  }
  const frames = birdFrames(s.look.plumage, s.look.wearing);
  drawSprite(g, frames[s.bird.wing], bx + BIRD_OFFSET.x, by + BIRD_OFFSET.y - BIRD_PAD);

  if (s.score !== null) {
    const num = numberSprite(s.score);
    g.save(); g.scale(2, 2);
    drawSprite(g, num, Math.round((w / 2 - num.w) / 2), 8);
    g.restore();
  }
}
