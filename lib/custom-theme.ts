// Custom themes from three colours (issue #131, ADR 0029). Pure functions: no DOM at import.
//   primary   → buttons, links, the active tab (brand tokens)
//   secondary → a tint on the page background, cards, borders and text
//   tertiary  → highlights (chips, tinted borders) and the focus ring
// Every generated text colour is moved lighter or darker until it meets the same WCAG AA
// pairs CI checks for the preset themes (lib/contrast.ts), in light and dark mode.
import { contrastRatio } from "./contrast.ts";

export interface CustomColors { primary: string; secondary: string; tertiary: string }
export type Palette = Record<string, string>;
export interface CustomTheme { light: Palette; dark: Palette; notes: string[] }

export const CUSTOM_COLORS_KEY = "martlet.theme.custom.colors";
export const CUSTOM_CSS_KEY = "martlet.theme.custom.css";
/** Starting point: McGill Classic's red, stone and a brighter red for focus. */
export const DEFAULT_CUSTOM_COLORS: CustomColors = { primary: "#991b1b", secondary: "#78716c", tertiary: "#b91c1c" };

const HEX = /^#[0-9a-f]{6}$/;
/** The only CSS the before-paint script will inject (see lib/theme.ts): nothing but our own token rules. */
export const CUSTOM_CSS_PATTERN = '^(\\[data-theme="custom"\\]\\[data-mode="(light|dark)"\\]\\{color-scheme:(light|dark);(--m-[a-z0-9-]+:#[0-9a-f]{6};)+\\})+$';

// Warning and success colours stay fixed so they keep their meaning (copied from McGill Classic).
const FIXED = {
  light: { "warn-soft": "#fffbeb", "warn-muted": "#fef3c7", "warn-line": "#fde68a", "warn-ink": "#78350f", "ok-soft": "#f0fdf4", "ok-line": "#bbf7d0", "ok-ink": "#166534" },
  dark: { "warn-soft": "#2a1f0a", "warn-muted": "#3a2a0c", "warn-line": "#6b4d12", "warn-ink": "#fcd77a", "ok-soft": "#0e2418", "ok-line": "#1f5c37", "ok-ink": "#8ce0aa" },
};

// ---- Colour helpers -------------------------------------------------------------------------

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return HEX.test(v) ? v : null;
}

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;

/** `t` of the way from `a` to `b`. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [toRgb(a), toRgb(b)];
  return toHex(x.map((c, i) => c + (y[i] - c) * t));
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  if (s === 0) return toHex([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const ch = (t: number) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return toHex([ch(h + 1 / 3), ch(h), ch(h - 1 / 3)].map((c) => c * 255));
}

/** Shift lightness by `delta` (-1..1), keeping hue and saturation. */
export function shiftLightness(hex: string, delta: number): string {
  const [h, s, l] = toHsl(hex);
  return fromHsl(h, s, Math.min(1, Math.max(0, l + delta)));
}

/** Make `fg` darker (or lighter) in small steps until it reaches `min` against every background.
 *  Pure black or white always gets there for the backgrounds generated here. */
export function ensureContrast(fg: string, backgrounds: string[], min: number, direction: "darker" | "lighter"): string {
  const passes = (c: string) => backgrounds.every((bg) => contrastRatio(c, bg) >= min + 0.05); // small margin for rounding
  let color = fg;
  for (let i = 0; i < 60 && !passes(color); i++) color = shiftLightness(color, direction === "darker" ? -0.02 : 0.02);
  return passes(color) ? color : direction === "darker" ? "#000000" : "#ffffff";
}

// ---- Palette generation ---------------------------------------------------------------------

function brandPair(primary: string, dark: boolean) {
  // Text on buttons: whichever of white / near-black reads better, then the button colour is
  // nudged until that text reaches 4.5:1.
  const onBrand = contrastRatio("#ffffff", primary) >= contrastRatio("#111111", primary) ? "#ffffff" : "#111111";
  const away = onBrand === "#ffffff" ? "darker" : "lighter";
  const brand = ensureContrast(primary, [onBrand], 4.5, away);
  const hover = ensureContrast(shiftLightness(brand, (away === "darker") !== dark ? -0.07 : 0.07), [onBrand], 4.5, away);
  return { brand, hover, onBrand };
}

function buildPalette({ primary, secondary, tertiary }: CustomColors, mode: "light" | "dark"): Palette {
  const dark = mode === "dark";
  const base = dark ? "#0b0b0c" : "#ffffff";       // what backgrounds are mixed towards
  const textBase = dark ? "#ffffff" : "#000000";  // what text is mixed towards
  const toText = dark ? "lighter" : "darker";
  const bg = (t: number) => mix(secondary, base, t);

  const canvas = bg(dark ? 0.9 : 0.94);
  const surface = bg(dark ? 0.84 : 0.985);
  const surfaceMuted = bg(dark ? 0.76 : 0.88);
  const all = [canvas, surface, surfaceMuted];
  const text = (t: number, against: string[], min: number) => ensureContrast(mix(secondary, textBase, t), against, min, toText);

  const { brand, hover, onBrand } = brandPair(primary, dark);
  const brandSoft = mix(primary, base, dark ? 0.82 : 0.92);
  const brandInk = ensureContrast(primary, [canvas, surface, brandSoft], 4.5, toText);

  return {
    canvas, surface, "surface-muted": surfaceMuted,
    line: bg(dark ? 0.7 : 0.8), "line-soft": dark ? bg(0.8) : surfaceMuted, "line-strong": bg(dark ? 0.55 : 0.65),
    ink: text(0.93, all, 7), "ink-soft": text(0.86, all, 4.5), "ink-2": text(0.74, all, 4.5),
    "ink-muted": text(0.64, all, 4.5), "ink-subtle": text(0.52, [canvas, surface], 3),
    brand, "brand-hover": hover, "on-brand": onBrand,
    "brand-ink": brandInk,
    "brand-ink-strong": ensureContrast(shiftLightness(brandInk, dark ? 0.1 : -0.08), [brandSoft], 4.5, toText),
    "brand-soft": brandSoft,
    "brand-muted": mix(tertiary, base, dark ? 0.72 : 0.84),
    "brand-line": mix(tertiary, base, dark ? 0.5 : 0.66),
    focus: ensureContrast(tertiary, [canvas, surface], 3, toText),
    ...FIXED[mode],
  };
}

/** Light and dark palettes, plus plain-language notes about any colour that had to change. */
export function buildCustomTheme(colors: CustomColors): CustomTheme {
  const light = buildPalette(colors, "light"), dark = buildPalette(colors, "dark");
  const notes: string[] = [];
  const changed = (a: string, b: string) => contrastRatio(a, b) > 1.15; // ignore tiny rounding shifts
  if (changed(light.brand, colors.primary) || changed(dark.brand, colors.primary)) {
    notes.push("Your primary colour was adjusted for buttons so their text stays readable.");
  }
  // Dark mode always uses lighter shades for links and focus (like the presets); only light-mode
  // changes are worth mentioning.
  if (changed(light["brand-ink"], colors.primary)) {
    notes.push("Links use a lighter or darker shade of your primary colour so they stay readable.");
  }
  if (changed(light.focus, colors.tertiary)) {
    notes.push("The focus ring uses a stronger shade of your tertiary colour so keyboard users can see it.");
  }
  return { light, dark, notes };
}

/** CSS rules for both modes, in the exact shape CUSTOM_CSS_PATTERN accepts. */
export function customThemeCss(theme: CustomTheme): string {
  return (["light", "dark"] as const).map((mode) =>
    `[data-theme="custom"][data-mode="${mode}"]{color-scheme:${mode};${Object.entries(theme[mode]).map(([k, v]) => `--m-${k}:${v};`).join("")}}`,
  ).join("");
}

/** Validates untrusted stored colours. */
export function parseCustomColors(raw: string | null): CustomColors | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const primary = normalizeHex(v?.primary), secondary = normalizeHex(v?.secondary), tertiary = normalizeHex(v?.tertiary);
    return primary && secondary && tertiary ? { primary, secondary, tertiary } : null;
  } catch { return null; }
}
