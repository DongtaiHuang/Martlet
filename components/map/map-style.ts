// MapLibre style selection. See docs/DEPLOYMENT.md.
// Default: OpenFreeMap (free, no key, production use allowed with attribution,
// which the style's attribution control shows). MapLibre's demo tiles are
// country outlines only — useless at campus zoom — so they are never used.
export const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();

export const mapStyleUrl: string =
  configured && !configured.includes("demotiles.maplibre.org") ? configured : DEFAULT_STYLE_URL;

// Dark mode (ADR 0012): OpenFreeMap's dark style unless NEXT_PUBLIC_MAP_STYLE_URL_DARK overrides it.
export const DEFAULT_DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const configuredDark = process.env.NEXT_PUBLIC_MAP_STYLE_URL_DARK?.trim();
export const mapStyleUrlDark: string =
  configuredDark && !configuredDark.includes("demotiles.maplibre.org") ? configuredDark : DEFAULT_DARK_STYLE_URL;

export const styleForMode = (mode: "light" | "dark") => (mode === "dark" ? mapStyleUrlDark : mapStyleUrl);
