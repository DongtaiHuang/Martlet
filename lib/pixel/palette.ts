// One pixel-art palette for the site's games (ADR 0044), taken from the art that already set the
// style: Marty (components/martlet/FlyingMartletSprite.tsx), the landmark towers
// (components/map/landmark-tower.ts) and the progress tree (components/progress/pixel-tree.ts).

/** Marty's colours. */
export const MARTY = {
  outline: "#39131d",
  capLight: "#b23a4a",
  cap: "#8c2635",
  body: "#9c2334",
  tail: "#751e2c",
  tailLight: "#ba3746",
  wingLight: "#ed6570",
  wing: "#ce3f50",
  wingDark: "#b02d3f",
  cream: "#fce8d5",
  creamShade: "#e7b89c",
  creamDark: "#d29a7d",
  beak: "#ee654e",
  beakShade: "#c94a36",
  blush: "#f4a3a0",
  eye: "#2a0f16",
} as const;

/** Campus scenery, shared with the landmark towers and the tree. */
export const CAMPUS = {
  ink: "#2a1d1a",
  brick: "#b5473a",
  brickShade: "#8e3328",
  stone: "#f1dfc0",
  stoneShade: "#d9c6a3",
  window: "#5f70ab",
  gold: "#f5c84c",
  goldShade: "#c9962c",
  leaf: "#2e7638",
  leafLight: "#4c9d44",
  leafDark: "#1d4a2a",
  grass: "#7c9838",
  grassLight: "#a9b24c",
  wood: "#4a2f1d",
  path: "#b5835a",
  pathShade: "#9c6b45",
  white: "#ffffff",
} as const;

/** Day and night skies, banded from top to bottom (dithered where bands meet). */
export const SKY = {
  day: ["#3f86d4", "#579ade", "#73afe8", "#94c6f0", "#cfe2f4"],
  night: ["#0b1430", "#141d3d", "#1e2550", "#2a2a55", "#3a2f5c"],
} as const;

/** Lighter or darker version of a hex colour: amount -1 (black) to 1 (white). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * A martlet's body colours for a plumage. Marty's own plumage uses his exact colours; others get
 * the same light-to-dark ramp built from their body and wing colours, with Marty's outline, cream
 * chest and coral beak, so every martlet reads as the same pixel character.
 */
export function martletRamp(body: string, wing: string, isMarty: boolean) {
  if (isMarty) {
    return { capLight: MARTY.capLight, cap: MARTY.cap, body: MARTY.body, tail: MARTY.tail, tailLight: MARTY.tailLight, wingLight: MARTY.wingLight, wing: MARTY.wing, wingDark: MARTY.wingDark };
  }
  return {
    capLight: shade(body, 0.25), cap: shade(body, -0.1), body, tail: wing, tailLight: shade(body, 0.15),
    wingLight: shade(body, 0.45), wing: shade(body, 0.2), wingDark: shade(wing, 0.1),
  };
}
