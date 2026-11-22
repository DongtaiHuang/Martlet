"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
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

  return (
    <div className="min-w-0">
      <div role="region" aria-label={`Map showing ${locationName}`} className="relative h-56 min-w-0 overflow-hidden rounded-xl border border-line bg-surface-muted sm:h-72">
        <div ref={container} className="h-full w-full" />
        {status !== "ready" && <p role="status" className="absolute inset-x-2 top-3 mx-auto w-fit rounded-lg bg-surface px-3 py-2 text-sm text-ink">
          {status === "loading" ? "Loading map…" : "Google Maps is unavailable."}
        </p>}
      </div>
      {showMeAndPlace && <ShowMeAndPlaceButton place={{ latitude, longitude }} placeName={locationName} onLocated={showUserAndPlace} />}
    </div>
  );
}
