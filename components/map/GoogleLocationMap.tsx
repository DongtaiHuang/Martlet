"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Box, Map as MapIcon } from "lucide-react";
import { googleMapId, loadGoogleLibrary } from "@/lib/google-maps";
import { FIT_PADDING, userDotElement, type Position } from "./locate-me";
import { ShowMeAndPlaceButton } from "./ShowMeAndPlaceButton";

export function GoogleLocationMap({ locationName, latitude, longitude, zoom = 16.5, showMeAndPlace = false }: {
  locationName: string;
  latitude: number;
  longitude: number;
  zoom?: number;
  showMeAndPlace?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const readLocation = useEffectEvent(() => ({ title: locationName, position: { lat: latitude, lng: longitude }, zoom }));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [threeD, setThreeD] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([loadGoogleLibrary("maps"), loadGoogleLibrary("marker")]).then(([maps, markers]) => {
      if (!active || !container.current) return;
      const location = readLocation();
      const map = new maps.Map(container.current, {
        center: location.position,
        zoom: location.zoom,
        mapId: googleMapId,
        gestureHandling: "cooperative",
        mapTypeControl: false,
        streetViewControl: false,
      });
      mapRef.current = map;
      const pin = new markers.PinElement({ background: "#991b1b", borderColor: "#7f1d1d", glyphColor: "#fff" });
      const marker = new markers.AdvancedMarkerElement({ map, position: location.position, title: location.title });
      marker.append(pin);
      markerRef.current = marker;
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });

    return () => {
      active = false;
      if (markerRef.current) markerRef.current.map = null;
      if (userMarkerRef.current) userMarkerRef.current.map = null;
      markerRef.current = null;
      userMarkerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const position = { lat: latitude, lng: longitude };
    marker.position = position;
    marker.title = locationName;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.setCenter(position);
    else map.panTo(position);
    map.setZoom(zoom);
  }, [latitude, longitude, locationName, zoom]);

  // Browser-only (ADR 0008): draw the user's dot and fit both points; nothing is sent anywhere.
  function showUserAndPlace(user: Position) {
    const map = mapRef.current;
    if (!map) return;
    const position = { lat: user.latitude, lng: user.longitude };
    userMarkerRef.current ??= new google.maps.marker.AdvancedMarkerElement({ map, content: userDotElement(), title: "Your approximate location" });
    userMarkerRef.current.position = position;
    const bounds = new google.maps.LatLngBounds(position).extend({ lat: latitude, lng: longitude });
    map.fitBounds(bounds, FIT_PADDING);
    // Don't zoom in closer than the landmark view when both points are very near each other.
    google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? zoom) > zoom) map.setZoom(zoom);
    });
  }

  // 3D view (issue #66): Google vector maps (mapId) support tilt and heading; orbit until touched.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.setTilt(threeD ? 67.5 : 0);
    if (!threeD) { map.setHeading(0); map.setZoom(zoom); return; }
    map.setZoom(Math.max(zoom, 18));
    if (reduced) return;
    let raf = 0, last = 0, stopped = false;
    const stop = () => { stopped = true; cancelAnimationFrame(raf); };
    const listener = map.addListener("dragstart", stop);
    const tick = (t: number) => {
      if (stopped) return;
      if (last) map.setHeading((map.getHeading() ?? 0) + ((t - last) / 1000) * 6);
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { stop(); listener.remove(); };
  }, [threeD, status, zoom]);

  return (
    <div className="min-w-0">
      <div role="region" aria-label={`Map showing ${locationName}`} className={`relative min-w-0 overflow-hidden rounded-xl border border-line bg-surface-muted transition-[height] duration-500 ${threeD ? "h-[26rem] sm:h-[32rem]" : "h-56 sm:h-72"}`}>
        <div ref={container} className="h-full w-full" />
        {status === "ready" && (
          <button
            type="button" aria-pressed={threeD} onClick={() => setThreeD((v) => !v)}
            className="absolute top-2 left-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface/95 px-3 text-sm font-bold text-ink shadow ring-1 ring-line hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus aria-pressed:bg-brand aria-pressed:text-on-brand aria-pressed:ring-brand"
          >
            {threeD ? <MapIcon aria-hidden="true" size={16} /> : <Box aria-hidden="true" size={16} />}
            {threeD ? "2D view" : "3D view"}
          </button>
        )}
        {status !== "ready" && <p role="status" className="absolute inset-x-2 top-3 mx-auto w-fit rounded-lg bg-surface px-3 py-2 text-sm text-ink">
          {status === "loading" ? "Loading map…" : "Google Maps is unavailable."}
        </p>}
      </div>
      {showMeAndPlace && <ShowMeAndPlaceButton place={{ latitude, longitude }} placeName={locationName} onLocated={showUserAndPlace} />}
    </div>
  );
}
