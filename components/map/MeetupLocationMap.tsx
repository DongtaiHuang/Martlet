"use client";
import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory } from "@/types/meetup";
import { MARKER_COLORS } from "./map-config";
import { mapStyleUrl } from "./map-style";

interface MeetupLocationMapProps {
  category: MeetupCategory;
  locationName: string;
  latitude: number;
  longitude: number;
}

/** Small single-pin map for the meetup detail page. */
export function MeetupLocationMap({ category, locationName, latitude, longitude }: MeetupLocationMapProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const center: [number, number] = [longitude, latitude];
    const map = new Map({
      container: ref.current,
      style: mapStyleUrl,
      center,
      zoom: 16.5,
      // Don't hijack page scrolling or rotate the map by accident on a small embed.
      scrollZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.touchZoomRotate.disableRotation();

    const marker = new Marker({ color: MARKER_COLORS[category] }).setLngLat(center).addTo(map);
    marker.getElement().setAttribute("aria-label", locationName);

    return () => map.remove();
  }, [category, locationName, latitude, longitude]);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={`Map showing ${locationName}`}
      className="h-56 w-full overflow-hidden rounded-xl border border-stone-200 sm:h-72"
    />
  );
}
