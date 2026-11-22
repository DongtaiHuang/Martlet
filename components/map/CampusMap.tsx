"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory, MeetupSummary } from "@/types/meetup";
import type { LandmarkSummary } from "@/types/landmark";
import { categories, categoryValues } from "@/components/feed/categories";
import { landmarkMarkerElement, landmarkPopupContent } from "./landmark-markers";
import { CAMPUS_MAP_FRAME, MARKER_COLORS, createCampusMap } from "./map-config";

const FOCUS_ZOOM = 17;

function popupContent(meetup: MeetupSummary, onOpen: (href: string) => void) {
  // Build with DOM APIs + textContent: never interpolate user-provided HTML.
  const root = document.createElement("div");
  root.style.cssText = "display:grid;gap:4px;max-width:220px;font:14px system-ui,sans-serif";
  const add = (tag: string, text: string, css = "") => {
    const el = document.createElement(tag);
    el.textContent = text;
    el.style.cssText = css;
    root.append(el);
    return el;
  };
  add("span", categories[meetup.category].label, "font-size:12px;font-weight:600;color:#57534e");
  add("strong", meetup.title, "overflow-wrap:anywhere");
  add("span", meetup.location_name);
  add("span", new Date(meetup.starts_at).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" }));
  add("span", `${meetup.attendee_count} going · ${meetup.flap_count} flaps`, "font-size:12px;color:#57534e");
  const href = `/meetups/${encodeURIComponent(meetup.id)}`;
  const link = add("a", "View meetup →", "font-weight:700;color:#991b1b;text-decoration:underline") as HTMLAnchorElement;
  link.href = href;
  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return; // allow open-in-new-tab
    e.preventDefault();
    onOpen(href);
  });
  return root;
}

const NO_LANDMARKS: LandmarkSummary[] = [];

/**
 * `focusId` (from /explore?meetup=<id>) centres the map on that meetup and opens its popup once.
 * `landmarks` (ADR 0009) are always shown as star pins, independent of the category filter.
 */
export function CampusMap({ meetups, focusId, landmarks = NO_LANDMARKS }: {
  meetups: MeetupSummary[];
  focusId?: string;
  landmarks?: LandmarkSummary[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const router = useRouter();
  const [active, setActive] = useState<MeetupCategory | "all">("all");

  const visible = useMemo(
    () => (active === "all" ? meetups : meetups.filter((m) => m.category === active)),
    [meetups, active],
  );
  const present = useMemo(() => new Set(meetups.map((m) => m.category)), [meetups]);
  // The Explore map only lists upcoming meetups, so a cancelled/past/unknown id won't be found.
  const focusMissing = Boolean(focusId) && !meetups.some((m) => m.id === focusId);

  useEffect(() => {
    if (!ref.current) return;
    const map = createCampusMap(ref.current);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const byId = markersRef.current;
    const markers = visible.map((meetup) => {
      const marker = new Marker({ color: MARKER_COLORS[meetup.category] })
        .setLngLat([meetup.longitude, meetup.latitude])
        .setPopup(new Popup({ offset: 24 }).setDOMContent(popupContent(meetup, (href) => router.push(href))))
        .addTo(map);
      marker.getElement().setAttribute("aria-label", `${meetup.title} at ${meetup.location_name}`);
      byId.set(meetup.id, marker);
      return marker;
    });
    return () => { markers.forEach((m) => m.remove()); byId.clear(); };
  }, [visible, router]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = landmarks.map((landmark) =>
      new Marker({ element: landmarkMarkerElement(landmark) })
        .setLngLat([landmark.longitude, landmark.latitude])
        .setPopup(new Popup({ offset: 18 }).setDOMContent(landmarkPopupContent(landmark, (href) => router.push(href))))
        .addTo(map));
    return () => markers.forEach((m) => m.remove());
  }, [landmarks, router]);

  // Runs after the marker effect above, and only when focusId changes, so changing
  // the category filter doesn't keep re-opening the popup.
  useEffect(() => {
    const map = mapRef.current;
    const marker = focusId ? markersRef.current.get(focusId) : undefined;
    if (!map || !marker) return;
    map.jumpTo({ center: marker.getLngLat(), zoom: FOCUS_ZOOM });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
  }, [focusId]);

  const chip = "min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-red-700";
  const chipState = (on: boolean) => (on ? "border-red-700 bg-red-700 text-white" : "border-stone-300 bg-white text-stone-800 hover:border-red-700");

  return (
    <div>
      {focusMissing && (
        <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          That meetup isn’t on the map anymore. It may have been cancelled or already started.
        </p>
      )}
      <div role="group" aria-label="Filter map by category" className="mb-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={active === "all"} onClick={() => setActive("all")} className={`${chip} ${chipState(active === "all")}`}>
          All ({meetups.length})
        </button>
        {categoryValues.filter((c) => present.has(c)).map((c) => (
          <button key={c} type="button" aria-pressed={active === c} onClick={() => setActive(c)} className={`${chip} ${chipState(active === c)}`}>
            {categories[c].label}
          </button>
        ))}
      </div>
      <div ref={ref} aria-label="Map of McGill meetups" className={CAMPUS_MAP_FRAME} />
      {visible.length === 0 && <p className="mt-3 text-sm text-stone-600">No upcoming meetups in this category.</p>}
    </div>
  );
}
