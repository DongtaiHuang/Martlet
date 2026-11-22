// Browser-only helpers for landmark pins (ADR 0009), shared by the Explore map and the
// Landmarks map. Built with DOM APIs + textContent: never interpolate HTML.
import type { LandmarkSummary } from "@/types/landmark";
import { buildPopup } from "./popup-content";
import { towerCells, towerSvg, towerTier } from "./landmark-tower";

/**
 * Tower pin: grows with the number of shared photos, grey until you discover it.
 * Use with `new Marker({ element, anchor: "bottom" })`; `height` is the pin's height in px
 * (for the popup offset). `cell` is the size of one pixel-art pixel.
 */
export function landmarkMarker(landmark: LandmarkSummary, cell = 2) {
  const tier = towerTier(landmark.unlock_count);
  const el = document.createElement("div");
  el.className = "martlet-tower";
  // Static markup: towerSvg only emits constant colours and numbers.
  el.innerHTML = towerSvg(tier, landmark.unlocked, { cell });
  el.style.cursor = "pointer";
  el.setAttribute("role", "button");
  el.setAttribute(
    "aria-label",
    `Landmark: ${landmark.name} (${landmark.unlocked ? "unlocked" : "locked"}, ${landmark.unlock_count} ${landmark.unlock_count === 1 ? "photo" : "photos"})`,
  );
  return { element: el, height: Math.round(towerCells(tier).h * cell) };
}

/** Popup with the challenge and a link to the landmark page (client-side navigation via onOpen). */
export function landmarkPopupContent(landmark: LandmarkSummary, onOpen: (href: string) => void) {
  return buildPopup({
    seed: `landmark:${landmark.id}`,
    muted: !landmark.unlocked,
    tag: `Landmark · ${landmark.unlocked ? "Completed" : "To discover"}`,
    tagTone: landmark.unlocked ? "green" : "gold",
    title: landmark.name,
    body: landmark.challenge_prompt,
    meta: [`${landmark.unlock_count} ${landmark.unlock_count === 1 ? "student has" : "students have"} unlocked it`],
    cta: { label: landmark.unlocked ? "View photos →" : "View challenge →", href: `/landmarks/${encodeURIComponent(landmark.id)}` },
    onOpen,
  });
}
