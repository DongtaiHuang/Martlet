"use client";

// Light/dark basemap handling shared by every map (ADR 0014).
import { useEffect, type RefObject } from "react";
import type { Map } from "maplibre-gl";
import { useColorMode } from "@/lib/useColorMode";
import { enhanceDarkBuildings } from "./dark-buildings";
import { styleForMode } from "./map-style";

const styleOf = new WeakMap<Map, string>();
const domMode = () => (document.documentElement.dataset.mode === "dark" ? "dark" : "light");

/** Style URL for a map created right now, matching the current light/dark mode. */
export const initialMapStyle = () => styleForMode(domMode());

/** Remember a new map's style and keep dark-mode buildings visible after every style load. */
export function trackMapStyle(map: Map, url: string) {
  styleOf.set(map, url);
  map.on("style.load", () => enhanceDarkBuildings(map, styleOf.get(map) ?? url));
}

/** Swap the basemap in place when the user changes light/dark mode; markers (DOM) are kept. */
export function useMapColorMode(mapRef: RefObject<Map | null>) {
  const mode = useColorMode();
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const url = styleForMode(mode);
    if (styleOf.get(map) !== url) { styleOf.set(map, url); map.setStyle(url); }
  }, [mode, mapRef]);
}
