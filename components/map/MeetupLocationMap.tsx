"use client";
import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory } from "@/types/meetup";
import { MARKER_COLORS } from "./map-config";
import { styleForMode } from "./map-style";
import { enhanceDarkBuildings } from "./dark-buildings";
import { useColorMode } from "@/lib/useColorMode";

interface MeetupLocationMapProps {
  /** Marker colour from the meetup category; ignored when `color` is given. */
  category?: MeetupCategory;
  color?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  zoom?: number;
}

/** Small single-pin map for meetup and landmark detail pages. */
export function MeetupLocationMap({ category, color, locationName, latitude, longitude, zoom = 16.5 }: MeetupLocationMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const markerColor = color ?? MARKER_COLORS[category ?? "other"];
  const mode = useColorMode();
  const mapRef = useRef<Map | null>(null);
  const styleRef = useRef("");

  useEffect(() => {
    if (!ref.current) return;
    const center: [number, number] = [longitude, latitude];
    styleRef.current = styleForMode((document.documentElement.dataset.mode === "dark" ? "dark" : "light"));
    const map = new Map({
      container: ref.current,
      style: styleRef.current,
      center,
      zoom,
      // Don't hijack page scrolling or rotate the map by accident on a small embed.
      scrollZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    // Runs after the first load and after every setStyle (mode switch).
    map.on("style.load", () => enhanceDarkBuildings(map, styleRef.current));
    map.touchZoomRotate.disableRotation();

    const marker = new Marker({ color: markerColor }).setLngLat(center).addTo(map);
    marker.getElement().setAttribute("aria-label", locationName);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [markerColor, locationName, latitude, longitude, zoom]);

  // Follow light/dark mode (ADR 0012): swap the basemap style in place; DOM markers are kept.
  useEffect(() => {
    const url = styleForMode(mode);
    if (mapRef.current && styleRef.current && styleRef.current !== url) { styleRef.current = url; mapRef.current.setStyle(url); }
  }, [mode]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={`Map showing ${locationName}`}
      className="h-56 w-full overflow-hidden rounded-xl border border-line sm:h-72"
    />
  );
}
