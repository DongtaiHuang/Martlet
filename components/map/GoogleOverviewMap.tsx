"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { googleMapId, loadGoogleLibrary } from "@/lib/google-maps";

export type GoogleOverviewPin = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  color: string;
  content: () => HTMLElement;
};

export function GoogleOverviewMap({ pins, focusId, onSelect, className }: {
  pins: GoogleOverviewPin[];
  focusId?: string;
  onSelect?: (id: string) => void;
  className: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<{
    map: google.maps.Map;
    markers: google.maps.MarkerLibrary;
    popup: google.maps.InfoWindow;
  }>();
  const [failed, setFailed] = useState(false);
  const select = useEffectEvent((id: string) => onSelect?.(id));
  const openPin = useRef<((id: string) => void) | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([loadGoogleLibrary("maps"), loadGoogleLibrary("marker")]).then(([maps, markers]) => {
      if (!active || !node.current) return;
      const map = new maps.Map(node.current, {
        center: { lat: 45.5045, lng: -73.577 },
        zoom: 16,
        mapId: googleMapId,
        gestureHandling: "cooperative",
        mapTypeControl: false,
        streetViewControl: false,
      });
      setSession({ map, markers, popup: new maps.InfoWindow({ maxWidth: 300 }) });
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    const { map, markers, popup } = session;
    const bounds = new google.maps.LatLngBounds();
    const entries = new Map<string, { marker: google.maps.marker.AdvancedMarkerElement; pin: GoogleOverviewPin }>();
    const open = (id: string) => {
      const entry = entries.get(id);
      if (!entry) return;
      popup.setContent(entry.pin.content());
      popup.open({ map, anchor: entry.marker });
    };
    openPin.current = (id) => {
      const position = entries.get(id)?.marker.position;
      if (!position) return;
      map.setCenter(position);
      map.setZoom(17);
      open(id);
    };
    const removals = pins.map((pin) => {
      const position = { lat: pin.latitude, lng: pin.longitude };
      bounds.extend(position);
      const marker = new markers.AdvancedMarkerElement({ map, position, title: pin.title, gmpClickable: true });
      marker.append(new markers.PinElement({ background: pin.color, glyphColor: "#fff" }));
      entries.set(pin.id, { marker, pin });
      const click = marker.addListener("click", () => {
        select(pin.id);
        open(pin.id);
      });
      return () => { click.remove(); marker.map = null; };
    });
    if (pins.length > 1) map.fitBounds(bounds, 56);
    if (pins.length === 1) map.setCenter(bounds.getCenter());
    return () => {
      popup.close();
      removals.forEach((remove) => remove());
      openPin.current = null;
    };
  }, [pins, session]);

  useEffect(() => {
    if (focusId) openPin.current?.(focusId);
  }, [focusId, pins, session]);

  return (
    <div className={`relative ${className}`}>
      <div ref={node} role="region" aria-label="Google map" className="h-full w-full" />
      {(!session || failed) && <p role="status" className="absolute inset-x-2 top-3 mx-auto w-fit rounded bg-surface px-3 py-2 text-sm text-ink">
        {failed ? "Google Maps is unavailable." : "Loading map…"}
      </p>}
    </div>
  );
}
