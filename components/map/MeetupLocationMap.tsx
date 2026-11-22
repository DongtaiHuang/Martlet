"use client";
import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory } from "@/types/meetup";
import { MARKER_COLORS } from "./map-config";
import { initialMapStyle, trackMapStyle, useMapColorMode } from "./map-mode";

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
  const mapRef = useRef<Map | null>(null);
  useMapColorMode(mapRef);

  useEffect(() => {
    if (!ref.current) return;
    const center: [number, number] = [longitude, latitude];
    const style = initialMapStyle(); // light or dark basemap (ADR 0014)
    const map = new Map({
      container: ref.current,
      style,
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
    trackMapStyle(map, style);
    map.touchZoomRotate.disableRotation();

    const marker = new Marker({ color: markerColor }).setLngLat(center).addTo(map);
    marker.getElement().setAttribute("aria-label", locationName);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [markerColor, locationName, latitude, longitude, zoom]);


  return (
    <div
      ref={ref}
      role="region"
      aria-label={`Map showing ${locationName}`}
      className="h-56 w-full overflow-hidden rounded-xl border border-line sm:h-72"
    />
  );
}
