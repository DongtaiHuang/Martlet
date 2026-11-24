"use client";

// Current colour mode + the user's preference (ADR 0014). The resolved mode lives on
// <html data-mode>, set before paint by themeInitScript; this hook observes it so maps and
// 3D scenes can follow, and lets the nav switch change it.
import { useCallback, useSyncExternalStore } from "react";
import { earn } from "@/components/achievements/earn";
import { CUSTOM_THEME, DEFAULT_MODE, MODE_KEY, MODES, THEME_KEY, THEMES, type ModePreference, type ThemeId } from "@/lib/theme";
import { buildCustomTheme, CUSTOM_COLORS_KEY, CUSTOM_CSS_KEY, CUSTOM_CSS_PATTERN, customThemeCss, parseCustomColors, type CustomColors } from "@/lib/custom-theme";

type Mode = "light" | "dark";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ModePreference {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v && (MODES as readonly string[]).includes(v)) return v as ModePreference;
  } catch {}
  return DEFAULT_MODE;
}
function readTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v && (THEMES as readonly string[]).includes(v)) return v as ThemeId;
    if (v === CUSTOM_THEME && readCustomCss()) return CUSTOM_THEME;
  } catch {}
  return "classic";
}

// ---- Custom theme (ADR 0029) ----------------------------------------------------------------
const customCssPattern = new RegExp(CUSTOM_CSS_PATTERN);
function readCustomCss(): string | null {
  try {
    const css = localStorage.getItem(CUSTOM_CSS_KEY);
    return css && customCssPattern.test(css) ? css : null;
  } catch { return null; }
}
/** Puts the custom rules on the page (the before-paint script does this on load). */
function injectCustomCss(css: string | null) {
  let el = document.getElementById("martlet-custom-theme");
  if (!css) { el?.remove(); return; }
  if (!el) { el = document.createElement("style"); el.id = "martlet-custom-theme"; document.head.appendChild(el); }
  el.textContent = css;
}
let colorsCache: { raw: string | null; value: CustomColors | null } = { raw: null, value: null };
function readCustomColors(): CustomColors | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(CUSTOM_COLORS_KEY); } catch {}
  if (raw !== colorsCache.raw) colorsCache = { raw, value: parseCustomColors(raw) }; // stable snapshot for useSyncExternalStore
  return colorsCache.value;
}
const resolve = (pref: ModePreference): Mode => (pref === "system" ? (darkQuery().matches ? "dark" : "light") : pref);

// Tiny event hub so every subscriber updates when the preference changes in this tab.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = darkQuery();
  const onSystem = () => { if (readPreference() === "system") { document.documentElement.dataset.mode = resolve("system"); emit(); } };
  const onStorage = (e: StorageEvent) => {
    if (e.key === MODE_KEY) { document.documentElement.dataset.mode = resolve(readPreference()); emit(); }
    if (e.key === CUSTOM_CSS_KEY) injectCustomCss(readCustomCss());
    if (e.key === THEME_KEY || e.key === CUSTOM_CSS_KEY) { document.documentElement.dataset.theme = readTheme(); emit(); }
    if (e.key === CUSTOM_COLORS_KEY) emit();
  };
  mq.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage); // other tabs
  return () => { listeners.delete(cb); mq.removeEventListener("change", onSystem); window.removeEventListener("storage", onStorage); };
}

/** Resolved mode actually shown ("light" | "dark"). */
export function useColorMode(): Mode {
  return useSyncExternalStore(subscribe, () => (document.documentElement.dataset.mode === "dark" ? "dark" : "light"), () => "light");
}

/** The user's preference ("light" | "dark" | "system") and a setter. */
export function useModePreference(): [ModePreference, (pref: ModePreference) => void] {
  const pref = useSyncExternalStore(subscribe, readPreference, () => DEFAULT_MODE);
  const set = useCallback((next: ModePreference) => {
    if (next === "dark") void earn("lights-out");
    try { localStorage.setItem(MODE_KEY, next); } catch {}
    document.documentElement.dataset.mode = resolve(next);
    emit();
  }, []);
  return [pref, set];
}

/** The chosen theme (Profile → Appearance) and a setter; applies instantly and syncs across tabs. */
export function useThemePreference(): [ThemeId, (theme: ThemeId) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "classic" as ThemeId);
  const set = useCallback((next: ThemeId) => {
    try { // Chameleon: three different themes tried on this device.
      const tried = new Set<string>(JSON.parse(localStorage.getItem("martlet.themes-tried") ?? "[]")); tried.add(next);
      localStorage.setItem("martlet.themes-tried", JSON.stringify([...tried]));
      if (tried.size >= 3) void earn("chameleon");
    } catch {}
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    document.documentElement.dataset.theme = next;
    emit();
  }, []);
  return [theme, set];
}

/** The student's own three colours (null until they make one) and a setter that builds the
 *  accessible light/dark palettes, saves them on this device and switches to the custom theme. */
export function useCustomTheme(): [CustomColors | null, (colors: CustomColors) => string[]] {
  const colors = useSyncExternalStore(subscribe, readCustomColors, () => null);
  const save = useCallback((next: CustomColors) => {
    const theme = buildCustomTheme(next);
    const css = customThemeCss(theme);
    try {
      localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(next));
      localStorage.setItem(CUSTOM_CSS_KEY, css);
      localStorage.setItem(THEME_KEY, CUSTOM_THEME);
    } catch {}
    injectCustomCss(css);
    document.documentElement.dataset.theme = CUSTOM_THEME;
    emit();
    return theme.notes;
  }, []);
  return [colors, save];
}
