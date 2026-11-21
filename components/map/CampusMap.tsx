"use client";
import { useEffect, useRef } from "react";
import { Map, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupSummary } from "@/types/meetup";

const mapStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
  (process.env.NODE_ENV === "development" ? "https://demotiles.maplibre.org/style.json" : undefined);

export function CampusMap({ meetups }: { meetups: MeetupSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !mapStyle) return;
    const map = new Map({
      container: ref.current, style: mapStyle,
      center: [-73.577, 45.5045], zoom: 15,
    });
    map.addControl(new NavigationControl(), "top-right");

    const markers = meetups.map((meetup) => {
      const popupContent = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = meetup.title; // safe: never interpolate user HTML
      const place = document.createElement("p");
      place.textContent = meetup.location_name;
      const link = document.createElement("a");
      link.href = `/meetups/${encodeURIComponent(meetup.id)}`;
      link.textContent = "View meetup";
      link.style.textDecoration = "underline";
      popupContent.append(title, place, link);

      return new Marker({ color: "#b91c1c" })
        .setLngLat([meetup.longitude, meetup.latitude])
        .setPopup(new Popup({ offset: 24 }).setDOMContent(popupContent))
        .addTo(map);
    });

    return () => { markers.forEach(marker => marker.remove()); map.remove(); };
  }, [meetups]);

  if (!mapStyle) {
    return <p className="rounded-2xl border border-neutral-200 bg-white p-5">The campus map is unavailable until a map style is configured.</p>;
  }

  return <div ref={ref} aria-label="Map of McGill meetups" className="h-[65vh] min-h-96 w-full overflow-hidden rounded-2xl border border-neutral-200" />;
}
