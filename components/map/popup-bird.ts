// A small pixel-art chick for map popups (matching the pixel-art progress tree): dark
// outline, brown cap/wing/tail, coloured body with a darker shaded side, orange beak.
// The body colour looks random per landmark/meetup but is derived from its id, so the
// same place always shows the same bird.

const BIRD_COLORS = [
  "#facc15", // yellow (the classic chick)
  "#fb923c", // orange
  "#f87171", // coral
  "#f472b6", // pink
  "#c084fc", // lilac
  "#818cf8", // periwinkle
  "#38bdf8", // sky
  "#2dd4bf", // teal
  "#4ade80", // mint
] as const;

/** Pick a colour from the palette, scattered by a simple string hash of `seed`. */
export function birdColor(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return BIRD_COLORS[(h >>> 0) % BIRD_COLORS.length];
}

/** Darken a #rrggbb colour by `amount` (0..1). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * (1 - amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

// 18x18 sprite, facing right. K outline, B brown, Y body, S body shade, O/R beak.
const SPRITE = [
  "......KKKKKK......",
  ".....KBBBBBBK.....",
  "....KBBBBBBBBK....",
  "...KBBBBYYYYYBK...",
  "...KBBBYYYBKYYYKK.",
  "...KBBYYYYKKYOOOK.",
  "KK.KBSYYYYYYYRRRRK",
  "KBKKSSYYYYYYYBKKK.",
  "KBBKSSYYYBYYYYK...",
  ".KBSSSYYYBBYYYK...",
  ".KSSSYYBBBBYYYK...",
  "..KSBBBBBSYYYYK...",
  "..KBSSSSYYYYYSK...",
  "...KBSSYYYYYSBK...",
  "....KBBSSSSBBK....",
  ".....KKKBBBKK.....",
  "......K...K.......",
  ".....KKK.KKK......",
];

const FIXED: Record<string, string> = {
  K: "#241a13", // outline
  B: "#8a4b23", // brown cap, wing, tail
  O: "#f5a524", // beak (top)
  R: "#e2661c", // beak (bottom)
};

/** SVG markup for the chick with a `color` body. Exported for previews/tests. */
export function birdSvg(color: string, size = 34): string {
  const fills: Record<string, string> = { ...FIXED, Y: color, S: shade(color, 0.18) };
  // One <path> per colour, built from horizontal runs of pixels.
  const runs: Record<string, string[]> = {};
  SPRITE.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      if (c !== ".") (runs[c] ??= []).push(`M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  const paths = Object.entries(runs).map(([c, d]) => `<path d="${d.join("")}" fill="${fills[c]}"/>`).join("");
  // Static markup; interpolated values are palette colours, derived shades and numbers.
  return `<svg viewBox="0 0 18 18" width="${size}" height="${size}" shape-rendering="crispEdges">${paths}</svg>`;
}

/** The bird as a decorative element for popups. */
export function birdIcon(color: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "martlet-popup__bird";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = birdSvg(color, 28);
  return span;
}
