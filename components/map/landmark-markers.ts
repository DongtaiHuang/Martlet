// Browser-only helpers for landmark pins (ADR 0009), shared by the Explore map and the
// Landmarks map. Built with DOM APIs + textContent: never interpolate HTML.
import type { LandmarkSummary } from "@/types/landmark";
import { LANDMARK_COLORS } from "./landmark-style";

/** Star pin: grey while locked, gold once unlocked. `size` in CSS px. */
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
  const root = document.createElement("div");
  root.style.cssText = "display:grid;gap:4px;max-width:220px;font:14px system-ui,sans-serif";
  const add = (tag: string, text: string, css = "") => {
    const el = document.createElement(tag);
    el.textContent = text;
    el.style.cssText = css;
    root.append(el);
    return el;
  };
  add("span", `★ Landmark · ${landmark.unlocked ? "Unlocked" : "Locked"}`, "font-size:12px;font-weight:600;color:#57534e");
  add("strong", landmark.name);
  add("span", landmark.challenge_prompt, "font-size:13px");
  add("span", `${landmark.unlock_count} unlocked`, "font-size:12px;color:#57534e");
  const href = `/landmarks/${encodeURIComponent(landmark.id)}`;
  const link = add("a", landmark.unlocked ? "View photos →" : "View challenge →", "font-weight:700;color:#991b1b;text-decoration:underline") as HTMLAnchorElement;
  link.href = href;
  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // allow open-in-new-tab
    e.preventDefault();
    onOpen(href);
  });
  return root;
}
