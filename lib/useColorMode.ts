"use client";

// Current colour mode + the user's preference (ADR 0014). The resolved mode lives on
// <html data-mode>, set before paint by themeInitScript; this hook observes it so maps and
// 3D scenes can follow, and lets the nav switch change it.
import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_MODE, MODE_KEY, MODES, THEME_KEY, THEMES, type ModePreference, type ThemeId } from "@/lib/theme";

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
  } catch {}
  return "classic";
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
    if (e.key === THEME_KEY) { document.documentElement.dataset.theme = readTheme(); emit(); }
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
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    document.documentElement.dataset.theme = next;
    emit();
  }, []);
  return [theme, set];
}
