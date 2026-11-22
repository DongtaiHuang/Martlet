// Browser-only builder for map popup content, shared by meetup and landmark popups so
// they look the same. Styled by the .martlet-popup classes in app/globals.css.
// Built with DOM APIs + textContent: never interpolate user-provided HTML.
import { birdColor, birdIcon } from "./popup-bird";

export interface PopupOptions {
  /** Stable id used to pick the bird's colour. */
  seed: string;
  /** Grey bird with no quote (an undiscovered landmark). */
  muted?: boolean;
  tag: string;
  tagTone?: "neutral" | "gold" | "green";
  title: string;
  body?: string;
  meta?: string[];
  cta: { label: string; href: string };
  /** Client-side navigation (router.push); modified clicks still open a new tab. */
  onOpen: (href: string) => void;
}

/** Max width passed to MapLibre's Popup so the rounded card has room to breathe. */
export const POPUP_MAX_WIDTH = "280px";

export function buildPopup({ seed, muted = false, tag, tagTone = "neutral", title, body, meta = [], cta, onOpen }: PopupOptions) {
  const el = (tag: string, className: string, text?: string) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const root = el("div", "martlet-popup");
  const header = el("div", "martlet-popup__header");
  header.append(birdIcon(birdColor(seed), muted), el("span", `martlet-popup__tag martlet-popup__tag--${tagTone}`, tag));
  root.append(header, el("strong", "martlet-popup__title", title));
  if (body) root.append(el("p", "martlet-popup__body", body));
  for (const line of meta) root.append(el("p", "martlet-popup__meta", line));

  const link = el("a", "martlet-popup__cta", cta.label) as HTMLAnchorElement;
  link.href = cta.href;
  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // allow open-in-new-tab
    e.preventDefault();
    onOpen(cta.href);
  });
  root.append(link);
  return root;
}
