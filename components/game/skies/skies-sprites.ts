// Pixel art for Martlet Skies (ADR 0044, 0046): Marty seen from behind with three wing frames,
// in the student's plumage, and a meetup pin. Relative .ts imports keep this testable.
import { MARTY, martletRamp } from "../../../lib/pixel/palette.ts";
import { grid, toSprite, type Sprite } from "../../../lib/pixel/sprite.ts";

// 26 x 13. C/A cap, B back, T tail, W/X/Y wing light/mid/dark, K outline.
const TAIL = ["........KTTK..KTTK........", ".......KTTK....KTTK.......", ".......KKK......KKK......."];
const FRAMES = {
  up: [
    "KK.........KKKK.........KK",
    "KWK.......KACCAK.......KWK",
    "KXWK......KAAAAK......KWXK",
    ".KXWKK...KBBBBBBK...KKWXK.",
    "..KYXWWKKBBBBBBBBKKWWXYK..",
    "...KYXXWWBBBBBBBBWWXXYK...",
    "....KKYYXBBBBBBBBXYYKK....",
    "......KKYBBBBBBBBYKK......",
    "........KBBBBBBBBK........",
    ".........KBBBBBBK.........",
    ...TAIL,
  ],
  mid: [
    "...........KKKK...........",
    "..........KACCAK..........",
    "..........KAAAAK..........",
    ".KKKK....KBBBBBBK....KKKK.",
    "KWWWWKKKKBBBBBBBBKKKKWWWWK",
    "KXXXXWWWWBBBBBBBBWWWWXXXXK",
    ".KYYYXXXXBBBBBBBBXXXXYYYK.",
    "..KKKYYYYBBBBBBBBYYYYKKK..",
    ".....KKKKBBBBBBBBKKKK.....",
    ".........KBBBBBBK.........",
    ...TAIL,
  ],
  down: [
    "...........KKKK...........",
    "..........KACCAK..........",
    "..........KAAAAK..........",
    "........KKBBBBBBKK........",
    "......KKWBBBBBBBBWKK......",
    "....KKWWXBBBBBBBBXWWKK....",
    "..KKWXXXYBBBBBBBBYXXXWKK..",
    ".KWXXYYYKBBBBBBBBKYYYXXWK.",
    "KXYYKKK..KBBBBBBK..KKKYYXK",
    "KKK.......KBBBBK.......KKK",
    ...TAIL,
  ],
} as const;
export type Wing = keyof typeof FRAMES;
export const BACK_W = 26;
export const BACK_H = 13;

const cache = new Map<string, Record<Wing, Sprite>>();

export function backFrames(plumage: { id: string; body: string; wing: string }): Record<Wing, Sprite> {
  const hit = cache.get(plumage.id);
  if (hit) return hit;
  const r = martletRamp(plumage.body, plumage.wing, plumage.id === "marty");
  const colors = { K: MARTY.outline, C: r.capLight, A: r.cap, B: r.body, T: r.tail, W: r.wingLight, X: r.wing, Y: r.wingDark };
  const frames = Object.fromEntries((Object.keys(FRAMES) as Wing[]).map((k) => [k, toSprite(grid(FRAMES[k]), colors)])) as Record<Wing, Sprite>;
  cache.set(plumage.id, frames);
  return frames;
}

/** A meetup marker: a speech bubble with a dot, in the site's brand red. */
export const MEETUP_PIN: Sprite = toSprite(grid([
  ".KKKKKKKKK.",
  "KRRRRRRRRRK",
  "KRWWRWWRWRK",
  "KRRRRRRRRRK",
  ".KKKRRKKKK.",
  "...KRK.....",
  "...KK......",
]), { K: MARTY.outline, R: "#c0263a", W: MARTY.cream });
