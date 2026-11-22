"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory } from "@/types/meetup";
import { MARKER_COLORS } from "./map-config";
import { mapStyleUrl } from "./map-style";

interface MeetupLocationMapProps {
  category?: MeetupCategory;
  color?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  zoom?: number;
}

export function MeetupLocationMap({ category, color, locationName, latitude, longitude, zoom = 16.5 }: MeetupLocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const markerColor = color ?? MARKER_COLORS[category ?? "other"];
  const initialCamera = useEffectEvent(() => ({ center: [longitude, latitude] as [number, number], zoom }));
  const currentLocation = useEffectEvent(() => ({ longitude, latitude, locationName }));

  useEffect(() => {
    if (!container.current) return;
    let map: Map | undefined;
    let active = true;
    let loaded = false;
    const loadingTimeout = window.setTimeout(() => {
      if (!loaded) setStatus("unavailable");
    }, 12_000);

    try {
      map = new Map({
        container: container.current,
        style: mapStyleUrl,
        ...initialCamera(),
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
      map.touchZoomRotate.disableRotation();
      map.on("load", () => {
        loaded = true;
        window.clearTimeout(loadingTimeout);
        setStatus("ready");
      });
      map.on("error", () => {
        if (!loaded) setStatus("unavailable");
      });
    } catch {
      queueMicrotask(() => {
        if (active) setStatus("unavailable");
      });
    }

    return () => {
      active = false;
      window.clearTimeout(loadingTimeout);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const location = currentLocation();
    const marker = new Marker({ color: markerColor })
      .setLngLat([location.longitude, location.latitude])
      .addTo(mapRef.current);
    marker.getElement().setAttribute("aria-label", location.locationName);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [markerColor]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const center: [number, number] = [longitude, latitude];
    marker.setLngLat(center);
    marker.getElement().setAttribute("aria-label", locationName);
    const camera = { center, zoom };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      map.jumpTo(camera);
      return;
    }
    const currentCenter = map.getCenter();
    if (map.isMoving() || currentCenter.lng !== longitude || currentCenter.lat !== latitude || map.getZoom() !== zoom) {
      map.flyTo({ ...camera, duration: 650 });
    }
  }, [latitude, longitude, locationName, zoom]);

  return (
    <div role="region" aria-label={`Map showing ${locationName}`} className="relative h-56 min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 sm:h-72">
      <div ref={container} className="h-full w-full [&_.maplibregl-ctrl-group_button]:size-11! [&_.maplibregl-ctrl-attrib-button]:size-11!" />
      {status !== "ready" && (
        <p role="status" className="pointer-events-none absolute inset-x-2 bottom-12 mx-auto w-fit rounded-lg bg-white px-3 py-2 text-center text-sm text-stone-800 shadow">
          {status === "loading" ? "Loading map…" : "The map is unavailable. You can still use the selected location."}
        </p>
      )}
    </div>
  );
}
