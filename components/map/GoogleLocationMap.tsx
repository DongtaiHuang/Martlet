"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { googleMapId, loadGoogleLibrary } from "@/lib/google-maps";

export function GoogleLocationMap({ locationName, latitude, longitude, zoom = 16.5 }: {
  locationName: string;
  latitude: number;
  longitude: number;
  zoom?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const readLocation = useEffectEvent(() => ({ title: locationName, position: { lat: latitude, lng: longitude }, zoom }));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

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
      markerRef.current = null;
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

  return (
    <div role="region" aria-label={`Map showing ${locationName}`} className="relative h-56 min-w-0 overflow-hidden rounded-xl border border-line bg-surface-muted sm:h-72">
      <div ref={container} className="h-full w-full" />
      {status !== "ready" && <p role="status" className="absolute inset-x-2 top-3 mx-auto w-fit rounded-lg bg-surface px-3 py-2 text-sm text-ink">
        {status === "loading" ? "Loading map…" : "Google Maps is unavailable."}
      </p>}
    </div>
  );
}
