"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GeolocateControl, Map, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory, MeetupSummary } from "@/types/meetup";
import type { LandmarkSummary } from "@/types/landmark";
import { categories, categoryValues } from "@/components/feed/categories";
import { LANDMARK_COLORS } from "./landmark-style";
import { CAMPUS_CENTER, MARKER_COLORS } from "./map-config";
import { mapStyleUrl } from "./map-style";

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

function landmarkPopupContent(landmark: LandmarkSummary, onOpen: (href: string) => void) {
  const root = document.createElement("div");
  root.style.cssText = "display:grid;gap:4px;max-width:220px;font:14px system-ui,sans-serif";
  const add = (tag: string, text: string, css = "") => {
    const el = document.createElement(tag);
    el.textContent = text; // never interpolate HTML
    el.style.cssText = css;
    root.append(el);
    return el;
  };
  add("span", `★ Landmark · ${landmark.unlocked ? "Unlocked" : "Locked"}`, "font-size:12px;font-weight:600;color:#57534e");
  add("strong", landmark.name);
  add("span", landmark.challenge_prompt, "font-size:13px");
  add("span", `${landmark.unlock_count} unlocked`, "font-size:12px;color:#57534e");
  const href = `/landmarks/${encodeURIComponent(landmark.id)}`;
  const link = add("a", landmark.unlocked ? "View photos →" : "View challenge →", "font-weight:700;color:#991b1b;text-decoration:underline") as HTMLAnchorElement;
  link.href = href;
  link.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onOpen(href);
  });
  return root;
}

function landmarkMarkerElement(landmark: LandmarkSummary) {
  const el = document.createElement("div");
  el.textContent = "★";
  el.style.cssText = [
    "width:30px", "height:30px", "border-radius:9999px", "display:grid", "place-items:center",
    `background:${landmark.unlocked ? LANDMARK_COLORS.unlocked : LANDMARK_COLORS.locked}`,
    "color:#fff", "font-size:17px", "line-height:1", "border:2px solid #fff",
    "box-shadow:0 1px 4px rgba(0,0,0,.35)", "cursor:pointer",
  ].join(";");
  el.setAttribute("aria-label", `Landmark: ${landmark.name} (${landmark.unlocked ? "unlocked" : "locked"})`);
  return el;
}

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
    const map = new Map({ container: ref.current, style: mapStyleUrl, center: CAMPUS_CENTER, zoom: 16 });
    map.addControl(new NavigationControl(), "top-right");
    // ADR 0008: opt-in, one-shot "show my location". The position stays in the
    // browser (MapLibre draws a dot); it is never sent to our server or stored.
    map.addControl(new GeolocateControl({
      trackUserLocation: false,
      positionOptions: { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
      fitBoundsOptions: { maxZoom: 16 },
    }), "top-right");
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
      <div ref={ref} aria-label="Map of McGill meetups" className="h-[65vh] min-h-96 w-full overflow-hidden rounded-2xl border border-neutral-200" />
      {visible.length === 0 && <p className="mt-3 text-sm text-stone-600">No upcoming meetups in this category.</p>}
    </div>
  );
}
