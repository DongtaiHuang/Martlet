"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupSummary } from "@/types/meetup";

export function CampusMap({ meetups }: { meetups: MeetupSummary[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const style = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";
    const map = new maplibregl.Map({
      container: ref.current, style,
      center: [-73.577, 45.5045], zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

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

      return new maplibregl.Marker({ color: "#b91c1c" })
        .setLngLat([meetup.longitude, meetup.latitude])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setDOMContent(popupContent))
        .addTo(map);
    });

    return () => { markers.forEach(marker => marker.remove()); map.remove(); };
  }, [meetups]);

  return <div ref={ref} aria-label="Map of McGill meetups" className="h-[65vh] min-h-96 w-full overflow-hidden rounded-2xl border border-neutral-200" />;
}
