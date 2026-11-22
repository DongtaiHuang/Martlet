// Theme + mode (ADR 0014). The inline script runs in <head> before first paint so the page never
// flashes the wrong colours. Kept dependency-free and tiny on purpose.
// Preview/review aid: `?mode=dark|light|system` and `?theme=<id>` on any URL set (and remember) them.

export const THEMES = ["classic", "redpath", "mountroyal", "contrast"] as const;
export const MODES = ["light", "dark", "system"] as const;
export type ThemeId = (typeof THEMES)[number];
export type ModePreference = (typeof MODES)[number];

/** Shown in Profile → Appearance. Colours live in app/theme.css (checked by scripts/check-contrast.mjs). */
export const THEME_INFO: Record<(typeof THEMES)[number], { label: string; description: string }> = {
  classic: { label: "McGill Classic", description: "Red, white and charcoal" },
  redpath: { label: "Redpath", description: "Warm sandstone and deep red" },
  mountroyal: { label: "Mount Royal", description: "Forest greens and cream" },
  contrast: { label: "High contrast", description: "Maximum legibility" },
};

export const THEME_KEY = "martlet.theme";
export const MODE_KEY = "martlet.mode";

/** Follow the device setting until the user picks Light or Dark in the nav switch. */
export const DEFAULT_MODE: ModePreference = "system";

export const themeInitScript = `(function(){try{
var d=document.documentElement,s=localStorage;
var q=new URLSearchParams(location.search).get("mode");if(${JSON.stringify(MODES)}.indexOf(q)>=0)s.setItem(${JSON.stringify(MODE_KEY)},q);
var qt=new URLSearchParams(location.search).get("theme");if(${JSON.stringify(THEMES)}.indexOf(qt)>=0)s.setItem(${JSON.stringify(THEME_KEY)},qt);
var t=s.getItem(${JSON.stringify(THEME_KEY)});if(${JSON.stringify(THEMES)}.indexOf(t)<0)t="classic";
var m=s.getItem(${JSON.stringify(MODE_KEY)})||${JSON.stringify(DEFAULT_MODE)};
if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
if(m!=="dark")m="light";
d.dataset.theme=t;d.dataset.mode=m;
}catch(e){}})();`;
