// The "Secret word" easter egg: a shower of pixel feathers in Marty's colours (ADR 0044).
// Browser-only. Plain DOM so it works on any page without a React tree of its own.
import { MARTY } from "@/lib/pixel/palette";
import { grid, spriteSvg, toSprite } from "@/lib/pixel/sprite";

// 7 x 13 feather: Q quill, V vane, L vane light, K outline.
const FEATHER = toSprite(grid([
  "...K...",
  "..KLK..",
  ".KLVVK.",
  ".KLQVK.",
  "KLVQVVK",
  "KLVQVVK",
  "KLVQVVK",
  ".KVQVK.",
  ".KVQVK.",
  "..KQK..",
  "...Q...",
  "...Q...",
  "...K...",
]), { K: MARTY.outline, V: MARTY.body, L: MARTY.wingLight, Q: MARTY.cream });
const SRC = `data:image/svg+xml,${encodeURIComponent(spriteSvg(FEATHER))}`;

export function featherShower(count = 28) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "martlet-feathers";
  for (let i = 0; i < count; i++) {
    const img = document.createElement("img");
    img.src = SRC;
    img.alt = "";
    const size = 21 + Math.round(Math.random() * 3) * 7; // whole-pixel scales: 3x to 6x
    img.style.cssText = `left:${Math.random() * 100}%;width:${size}px;animation-duration:${2.4 + Math.random() * 1.8}s;animation-delay:${Math.random() * 0.8}s;--sway:${Math.random() < 0.5 ? -1 : 1}`;
    layer.append(img);
  }
  document.body.append(layer);
  window.setTimeout(() => layer.remove(), 5500);
}
