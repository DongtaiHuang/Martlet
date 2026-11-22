"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { LngLatBounds, Map, Marker, NavigationControl } from "maplibre-gl";
import { Box, Map as MapIcon } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory } from "@/types/meetup";
import { MARKER_COLORS } from "./map-config";
import { initialMapStyle, trackMapStyle, useMapColorMode } from "./map-mode";
import { addBeacon, removeBeacon, setRotateTilt, startOrbit } from "./meetup-3d";
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
  const [threeD, setThreeD] = useState(false);
  const threeDRef = useRef(false);
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
      // Keep the 3D beacon after a light/dark style swap (style.load fires after setStyle).
      map.on("style.load", () => {
        if (!threeDRef.current || !map) return;
        const { longitude: lng, latitude: lat } = currentLocation();
        addBeacon(map, lng, lat);
      });
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

  // 3D view (issue #66): tilt, extruded buildings, beacon pillar and a gentle orbit.
  useEffect(() => {
    const map = mapRef.current;
    threeDRef.current = threeD;
    if (!map || status !== "ready") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { longitude: lng, latitude: lat } = currentLocation();
    const frame = requestAnimationFrame(() => map.resize()); // the frame grows/shrinks with the mode
    let stopOrbit = () => {};
    setRotateTilt(map, threeD);
    if (threeD) {
      addBeacon(map, lng, lat);
      const camera = { center: [lng, lat] as [number, number], pitch: 62, bearing: -25, zoom: Math.max(zoom, 16.8) };
      if (reduced) map.jumpTo(camera);
      else {
        map.easeTo({ ...camera, duration: 1400 });
        map.once("moveend", () => { if (threeDRef.current) stopOrbit = startOrbit(map); });
      }
    } else {
      removeBeacon(map);
      const flat = { center: [lng, lat] as [number, number], pitch: 0, bearing: 0, zoom };
      if (reduced) map.jumpTo(flat); else map.easeTo({ ...flat, duration: 900 });
    }
    return () => { cancelAnimationFrame(frame); stopOrbit(); };
  }, [threeD, status, zoom]);

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
      <div role="region" aria-label={`Map showing ${locationName}`} className={`relative min-w-0 overflow-hidden rounded-xl border border-line bg-surface-muted transition-[height] duration-500 ${threeD ? "h-[26rem] sm:h-[32rem]" : "h-56 sm:h-72"}`}>
        <div ref={container} className="h-full w-full [&_.maplibregl-ctrl-group_button]:size-11! [&_.maplibregl-ctrl-attrib-button]:size-11!" />
        {status === "ready" && (
          <button
            type="button" aria-pressed={threeD} onClick={() => setThreeD((v) => !v)}
            className="absolute top-2 left-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface/95 px-3 text-sm font-bold text-ink shadow ring-1 ring-line hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-brand aria-pressed:text-on-brand aria-pressed:ring-brand"
          >
            {threeD ? <MapIcon aria-hidden="true" size={16} /> : <Box aria-hidden="true" size={16} />}
            {threeD ? "2D view" : "3D view"}
          </button>
        )}
        {threeD && status === "ready" && (
          <p className="pointer-events-none absolute right-2 bottom-8 rounded-lg bg-surface/90 px-2.5 py-1 text-xs text-ink-muted shadow">Drag to orbit · right-drag or two fingers to tilt</p>
        )}
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
