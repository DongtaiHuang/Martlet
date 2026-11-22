// Theme + mode (ADR 0011). The inline script runs in <head> before first paint so the page never
// flashes the wrong colours. Kept dependency-free and tiny on purpose.

export const THEMES = ["classic"] as const;
export const MODES = ["light", "dark", "system"] as const;
export type ThemeId = (typeof THEMES)[number];
export type ModePreference = (typeof MODES)[number];

export const THEME_KEY = "martlet.theme";
export const MODE_KEY = "martlet.mode";

/**
 * Until every area is migrated to tokens, the default mode is "light" (no visual change).
 * Flip DEFAULT_MODE to "system" when dark mode ships.
 */
export const DEFAULT_MODE: ModePreference = "light";

export const themeInitScript = `(function(){try{
var d=document.documentElement,s=localStorage;
var t=s.getItem(${JSON.stringify(THEME_KEY)});if(${JSON.stringify(THEMES)}.indexOf(t)<0)t="classic";
var m=s.getItem(${JSON.stringify(MODE_KEY)})||${JSON.stringify(DEFAULT_MODE)};
if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
if(m!=="dark")m="light";
d.dataset.theme=t;d.dataset.mode=m;
}catch(e){}})();`;
