// MapLibre style selection. See docs/DEPLOYMENT.md.
export const DEMO_STYLE_URL = "https://demotiles.maplibre.org/style.json";

const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
const isProduction = process.env.NODE_ENV === "production";

/** Demo tiles are allowed in development only; production without a real style gets no map. */
export const mapStyleUrl: string | undefined =
  configured && !(isProduction && configured.includes("demotiles.maplibre.org"))
    ? configured
    : isProduction ? undefined : DEMO_STYLE_URL;
