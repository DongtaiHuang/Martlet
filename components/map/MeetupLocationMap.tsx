"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { LngLatBounds, Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory } from "@/types/meetup";
import { MARKER_COLORS } from "./map-config";
import { initialMapStyle, trackMapStyle, useMapColorMode } from "./map-mode";
import { GoogleLocationMap } from "./GoogleLocationMap";
import { hasGoogleMaps } from "@/lib/google-maps";
import { FIT_PADDING, userDotElement, type Position } from "./locate-me";
import { ShowMeAndPlaceButton } from "./ShowMeAndPlaceButton";

interface MeetupLocationMapProps {
  category?: MeetupCategory;
  color?: string;
  locationName: string;
  latitude: number;
  longitude: number;
  zoom?: number;
  /** Adds an opt-in "Show me and <place>" button that frames the user and this place (issue #34, ADR 0008). */
  showMeAndPlace?: boolean;
}

export function MeetupLocationMap(props: MeetupLocationMapProps) {
  return hasGoogleMaps ? <GoogleLocationMap {...props} /> : <MapLibreLocationMap {...props} />;
}

function MapLibreLocationMap({ category, color, locationName, latitude, longitude, zoom = 16.5, showMeAndPlace = false }: MeetupLocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
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
      const style = initialMapStyle();
      map = new Map({
        container: container.current,
        style,
        ...initialCamera(),
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      trackMapStyle(map, style);
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
      userMarkerRef.current = null;
    };
  }, []);
  useMapColorMode(mapRef);

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

  // Browser-only (ADR 0008): draw the user's dot and fit both points; nothing is sent anywhere.
  function showUserAndPlace(user: Position) {
    const map = mapRef.current;
    if (!map) return;
    const lngLat: [number, number] = [user.longitude, user.latitude];
    userMarkerRef.current ??= new Marker({ element: userDotElement() }).setLngLat(lngLat).addTo(map);
    userMarkerRef.current.setLngLat(lngLat);
    const bounds = new LngLatBounds(lngLat, lngLat).extend([longitude, latitude]);
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: zoom, duration: instant ? 0 : 900 });
  }

  return (
    <div className="min-w-0">
      <div role="region" aria-label={`Map showing ${locationName}`} className="relative h-56 min-w-0 overflow-hidden rounded-xl border border-line bg-surface-muted sm:h-72">
        <div ref={container} className="h-full w-full [&_.maplibregl-ctrl-group_button]:size-11! [&_.maplibregl-ctrl-attrib-button]:size-11!" />
        {status !== "ready" && (
          <p role="status" className="pointer-events-none absolute inset-x-2 bottom-12 mx-auto w-fit rounded-lg bg-surface px-3 py-2 text-center text-sm text-ink-soft shadow">
            {status === "loading" ? "Loading map…" : "The map is unavailable. You can still use the selected location."}
          </p>
        )}
      </div>
      {showMeAndPlace && <ShowMeAndPlaceButton place={{ latitude, longitude }} placeName={locationName} onLocated={showUserAndPlace} />}
    </div>
  );
}
