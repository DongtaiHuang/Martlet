// Theme + mode (ADR 0014). The inline script runs in <head> before first paint so the page never
// flashes the wrong colours. Kept dependency-free and tiny on purpose.
// Preview/review aid: `?mode=dark|light|system` on any URL sets (and remembers) the mode.

export const THEMES = ["classic"] as const;
export const MODES = ["light", "dark", "system"] as const;
export type ThemeId = (typeof THEMES)[number];
export type ModePreference = (typeof MODES)[number];

export const THEME_KEY = "martlet.theme";
export const MODE_KEY = "martlet.mode";

/** Follow the device setting until the user picks Light or Dark in the nav switch. */
export const DEFAULT_MODE: ModePreference = "system";

export const themeInitScript = `(function(){try{
var d=document.documentElement,s=localStorage;
var q=new URLSearchParams(location.search).get("mode");if(${JSON.stringify(MODES)}.indexOf(q)>=0)s.setItem(${JSON.stringify(MODE_KEY)},q);
var t=s.getItem(${JSON.stringify(THEME_KEY)});if(${JSON.stringify(THEMES)}.indexOf(t)<0)t="classic";
var m=s.getItem(${JSON.stringify(MODE_KEY)})||${JSON.stringify(DEFAULT_MODE)};
if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
if(m!=="dark")m="light";
d.dataset.theme=t;d.dataset.mode=m;
}catch(e){}})();`;
