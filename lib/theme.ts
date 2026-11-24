// Theme + mode (ADR 0014). The inline script runs in <head> before first paint so the page never
// flashes the wrong colours. Kept dependency-free and tiny on purpose.
// Preview/review aid: `?mode=dark|light|system` and `?theme=<id>` on any URL set (and remember) them.
// The "custom" theme (ADR 0029) is built from the student's own colours; its CSS is stored on the
// device and injected here only if it matches CUSTOM_CSS_PATTERN.
import { CUSTOM_CSS_KEY, CUSTOM_CSS_PATTERN } from "./custom-theme";

export const THEMES = ["classic", "redpath", "mountroyal", "summer", "fall", "winter", "cny", "contrast"] as const;
export const MODES = ["light", "dark", "system"] as const;
/** Built from the student's own colours (ADR 0029); not part of THEMES, which are the presets. */
export const CUSTOM_THEME = "custom" as const;
export type PresetThemeId = (typeof THEMES)[number];
export type ThemeId = PresetThemeId | typeof CUSTOM_THEME;
export type ModePreference = (typeof MODES)[number];

/** Shown in Profile → Appearance. Colours live in app/theme.css (checked by scripts/check-contrast.mjs). */
export const THEME_INFO: Record<ThemeId, { label: string; description: string }> = {
  classic: { label: "McGill Classic", description: "Red, white and charcoal" },
  redpath: { label: "Redpath", description: "Warm sandstone and deep red" },
  mountroyal: { label: "Mount Royal", description: "Forest greens and cream" },
  summer: { label: "Summer", description: "Warm sun, beach sand and rubber duckies" },
  fall: { label: "Fall", description: "Fallen-leaf orange, rust and bark brown" },
  winter: { label: "Winter", description: "Icy blues, snow white and falling snow" },
  cny: { label: "Chinese New Year", description: "Crimson and gold, lanterns and red pockets" },
  contrast: { label: "High contrast", description: "Maximum legibility" },
  custom: { label: "Your colours", description: "Your own primary, secondary and tertiary" },
};

export const THEME_KEY = "martlet.theme";
export const MODE_KEY = "martlet.mode";

/** Follow the device setting until the user picks Light or Dark in the nav switch. */
export const DEFAULT_MODE: ModePreference = "system";

export const themeInitScript = `(function(){try{
var d=document.documentElement,s=localStorage;
var q=new URLSearchParams(location.search).get("mode");if(${JSON.stringify(MODES)}.indexOf(q)>=0)s.setItem(${JSON.stringify(MODE_KEY)},q);
var qt=new URLSearchParams(location.search).get("theme");if(${JSON.stringify(THEMES)}.indexOf(qt)>=0)s.setItem(${JSON.stringify(THEME_KEY)},qt);
var t=s.getItem(${JSON.stringify(THEME_KEY)});
if(t===${JSON.stringify(CUSTOM_THEME)}){var c=s.getItem(${JSON.stringify(CUSTOM_CSS_KEY)});if(c&&new RegExp(${JSON.stringify(CUSTOM_CSS_PATTERN)}).test(c)){var e=document.createElement("style");e.id="martlet-custom-theme";e.textContent=c;document.head.appendChild(e);}else t="classic";}
else if(${JSON.stringify(THEMES)}.indexOf(t)<0)t="classic";
var m=s.getItem(${JSON.stringify(MODE_KEY)})||${JSON.stringify(DEFAULT_MODE)};
if(m==="system")m=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
if(m!=="dark")m="light";
d.dataset.theme=t;d.dataset.mode=m;
}catch(e){}})();`;
