// A small, round sparrow for map popups (based on a hand-drawn reference: fluffy cream
// body, coloured cap, wing and tail, wide-set eyes, tiny beak, rosy cheeks). Each
// landmark/meetup gets a random-looking colour derived from its id, so the same place
// always shows the same bird.

const BIRD_COLORS = [
  "#f87171", // coral
  "#fb923c", // orange
  "#facc15", // sunflower
  "#4ade80", // mint
  "#2dd4bf", // teal
  "#38bdf8", // sky
  "#818cf8", // periwinkle
  "#c084fc", // lilac
  "#f472b6", // pink
] as const;

/** Pick a colour from the palette, scattered by a simple string hash of `seed`. */
export function birdColor(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return BIRD_COLORS[(h >>> 0) % BIRD_COLORS.length];
}

const INK = "#57534e"; // soft pencil outline
const CREAM = "#fbf6ec";

/** SVG markup for the sparrow in `color`. Exported for previews/tests. */
export function birdSvg(color: string, size = 34): string {
  // Static markup; the only interpolated values are a palette colour and a number.
  return `
    <svg viewBox="0 0 40 40" width="${size}" height="${size}">
      <g stroke="${INK}" stroke-width="0.65" stroke-linecap="round" stroke-linejoin="round">
        <!-- feet -->
        <path d="M14 34.5 L12.5 37 M14 34.5 L15 37.2 M14 34.5 L16.5 36.4" fill="none" />
        <path d="M22 34.5 L20.8 37.2 M22 34.5 L23.5 37 M22 34.5 L25 36.2" fill="none" />
        <!-- tail -->
        <path d="M29.5 27 L38.5 30.5 L36.6 32 L30 31.5 Z" fill="${color}" />
        <!-- round fluffy body -->
        <path d="M18.5 7.5 C28 7.5 33.5 14 33 22.5 C32.5 30.5 26.5 35.5 18.5 35.5 C10 35.5 4.5 30 4.8 21.8 C5 13.5 10 7.5 18.5 7.5 Z" fill="${CREAM}" />
        <!-- fluffy chest tufts -->
        <path d="M5.2 19 L3.6 20.4 L5 21.2 M5 24 L3.4 25.6 L5.3 26" fill="none" />
      </g>
      <!-- soft shading on the lower belly -->
      <ellipse cx="18" cy="30.5" rx="11" ry="4.5" fill="${color}" opacity="0.16" />
      <g stroke="${INK}" stroke-width="0.65" stroke-linecap="round" stroke-linejoin="round">
        <!-- cap -->
        <path d="M6.6 17 C7.4 10.5 12.5 7.6 18.5 7.6 C25.5 7.6 31 11.2 32.6 17.8 C29.5 14.6 25.8 13.6 22.6 15 C20.2 13.4 15.5 13.2 12.6 15 C10.6 14.6 8.4 15.4 6.6 17 Z" fill="${color}" />
        <!-- wing tucked on the side, with feather marks -->
        <path d="M23.5 23 C28.5 21 33 24 32.4 29 C31.8 33 27.6 34.6 24.4 33.2 C22.2 30.8 21.8 26 23.5 23 Z" fill="${color}" />
        <path d="M25.6 26 L30.2 28.6 M25.4 29 L29.8 31.4 M26.4 23.9 L30.8 26" fill="none" opacity="0.45" />
      </g>
      <!-- darker edge of the wing for depth -->
      <path d="M24.4 33.2 C27.6 34.6 31.8 33 32.4 29 C31 32 28 33.2 24.4 33.2 Z" fill="#000000" opacity="0.12" />
      <!-- rosy cheeks -->
      <ellipse cx="9.6" cy="22.6" rx="2" ry="1.2" fill="#fb7185" opacity="0.35" />
      <ellipse cx="23" cy="22.2" rx="1.9" ry="1.1" fill="#fb7185" opacity="0.35" />
      <!-- wide-set eyes with highlights -->
      <circle cx="11.6" cy="19.4" r="1.7" fill="#1c1917" />
      <circle cx="21.4" cy="19.4" r="1.9" fill="#1c1917" />
      <circle cx="12.1" cy="18.9" r="0.55" fill="#ffffff" />
      <circle cx="22" cy="18.8" r="0.6" fill="#ffffff" />
      <!-- tiny beak -->
      <path d="M15 21.2 Q16.6 20.2 18.2 21.2 Q16.6 23.6 15 21.2 Z" fill="#c9a27a" stroke="${INK}" stroke-width="0.6" stroke-linejoin="round" />
    </svg>`;
}

/** The bird as a decorative element for popups. */
export function birdIcon(color: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "martlet-popup__bird";
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = birdSvg(color);
  return span;
}
