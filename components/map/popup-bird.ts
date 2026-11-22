// A small, cute bird for map popups. Each landmark/meetup gets a random-looking colour that
// is derived from its id, so the same place always shows the same bird.

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

/** Round little bird facing right: body + head, belly, wing, tail, beak, eye. */
export function birdIcon(color: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "martlet-popup__bird";
  span.setAttribute("aria-hidden", "true");
  // Static markup; the only interpolated value is a colour from BIRD_COLORS above.
  span.innerHTML = `
    <svg viewBox="0 0 32 32" width="30" height="30">
      <path d="M6 18 L1 15 L3 21 Z" fill="${color}" />
      <ellipse cx="14" cy="19" rx="10" ry="8.5" fill="${color}" />
      <circle cx="20" cy="12" r="6.5" fill="${color}" />
      <ellipse cx="15" cy="22" rx="6.5" ry="4.5" fill="#ffffff" opacity="0.45" />
      <path d="M8 17 Q12 12 17 17 Q12 21 8 17 Z" fill="#000000" opacity="0.16" />
      <path d="M26 11.5 L30 13 L26 14.5 Z" fill="#f59e0b" />
      <circle cx="22" cy="11" r="1.5" fill="#1c1917" />
      <circle cx="22.5" cy="10.5" r="0.5" fill="#ffffff" />
      <circle cx="18" cy="15" r="1.6" fill="#fb7185" opacity="0.45" />
    </svg>`;
  return span;
}
