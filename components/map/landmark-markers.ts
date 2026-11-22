// Browser-only helpers for landmark pins (ADR 0009), shared by the Explore map and the
// Landmarks map. Built with DOM APIs + textContent: never interpolate HTML.
import type { LandmarkSummary } from "@/types/landmark";
import { LANDMARK_COLORS } from "./landmark-style";
import { buildPopup } from "./popup-content";

/** Star pin: gold while still to discover, green once completed. `size` in CSS px. */
export function landmarkMarkerElement(landmark: LandmarkSummary, size = 30) {
  const el = document.createElement("div");
  el.textContent = "★";
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, "border-radius:9999px", "display:grid", "place-items:center",
    `background:${landmark.unlocked ? LANDMARK_COLORS.unlocked : LANDMARK_COLORS.locked}`,
    "color:#fff", `font-size:${Math.round(size * 0.57)}px`, "line-height:1", "border:2px solid #fff",
    "box-shadow:0 1px 4px rgba(0,0,0,.35)", "cursor:pointer",
  ].join(";");
  el.setAttribute("aria-label", `Landmark: ${landmark.name} (${landmark.unlocked ? "unlocked" : "locked"})`);
  return el;
}

/** Popup with the challenge and a link to the landmark page (client-side navigation via onOpen). */
export function landmarkPopupContent(landmark: LandmarkSummary, onOpen: (href: string) => void) {
  return buildPopup({
    seed: `landmark:${landmark.id}`,
    tag: `Landmark · ${landmark.unlocked ? "Completed" : "To discover"}`,
    tagTone: landmark.unlocked ? "green" : "gold",
    title: landmark.name,
    body: landmark.challenge_prompt,
    meta: [`${landmark.unlock_count} ${landmark.unlock_count === 1 ? "student has" : "students have"} unlocked it`],
    cta: { label: landmark.unlocked ? "View photos →" : "View challenge →", href: `/landmarks/${encodeURIComponent(landmark.id)}` },
    onOpen,
  });
}
