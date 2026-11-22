"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LngLatBounds, Map, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MeetupCategory, MeetupSummary } from "@/types/meetup";
import type { LandmarkSummary } from "@/types/landmark";
import { PUBLIC_VENUES } from "@/lib/public-venues";
import { categories, categoryValues } from "@/components/feed/categories";
import { landmarkMarker, landmarkPopupContent } from "./landmark-markers";
import { POPUP_MAX_WIDTH, buildPopup } from "./popup-content";
import { CAMPUS_CENTER, CAMPUS_MAP_FRAME, MARKER_COLORS, createCampusMap } from "./map-config";
import { useMapColorMode } from "./map-mode";

const FOCUS_ZOOM = 17;

function popupContent(meetup: MeetupSummary, onOpen: (href: string) => void) {
  return buildPopup({
    seed: `meetup:${meetup.id}`,
    tag: categories[meetup.category].label,
    title: meetup.title,
    body: meetup.location_name,
    meta: [
      new Date(meetup.starts_at).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" }),
      `${meetup.attendee_count} going · ${meetup.flap_count} flaps`,
    ],
    cta: { label: "View meetup →", href: `/meetups/${encodeURIComponent(meetup.id)}` },
    onOpen,
  });
}

const NO_LANDMARKS: LandmarkSummary[] = [];

/**
 * `focusId` (from /explore?meetup=<id>) centres the map on that meetup and opens its popup once.
 * `landmarks` (ADR 0009) are shown as tower pins, independent of the category filter.
 */
export function CampusMap({ meetups, focusId, landmarks = NO_LANDMARKS }: {
  meetups: MeetupSummary[];
  focusId?: string;
  landmarks?: LandmarkSummary[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  useMapColorMode(mapRef);
  const markersRef = useRef(new globalThis.Map<string, Marker>());
  const router = useRouter();
  const [active, setActive] = useState<MeetupCategory | "all">("all");
  const [layer, setLayer] = useState<"all" | "meetups" | "landmarks">("all");

  const visible = useMemo(() => {
    if (layer === "landmarks") return [];
    return active === "all" ? meetups : meetups.filter((m) => m.category === active);
  }, [meetups, active, layer]);
  const shownLandmarks = useMemo(() => (layer === "meetups" ? NO_LANDMARKS : landmarks), [landmarks, layer]);
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
        .setPopup(new Popup({ offset: 24, maxWidth: POPUP_MAX_WIDTH }).setDOMContent(popupContent(meetup, (href) => router.push(href))))
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
    const markers = shownLandmarks.map((landmark) => {
      const { element, height } = landmarkMarker(landmark, 1.75);
      return new Marker({ element, anchor: "bottom" })
        .setLngLat([landmark.longitude, landmark.latitude])
        .setPopup(new Popup({ offset: height + 4, maxWidth: POPUP_MAX_WIDTH }).setDOMContent(landmarkPopupContent(landmark, (href) => router.push(href))))
        .addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [shownLandmarks, router]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || focusId) return;
    const hasPublicMeetup = meetups.some((meetup) => PUBLIC_VENUES.some((venue) =>
      meetup.location_name === venue.name && meetup.latitude === venue.latitude && meetup.longitude === venue.longitude));
    if (!hasPublicMeetup) return;
    const bounds = new LngLatBounds(CAMPUS_CENTER, CAMPUS_CENTER);
    meetups.forEach(({ longitude, latitude }) => bounds.extend([longitude, latitude]));
    map.fitBounds(bounds, { padding: 40, maxZoom: FOCUS_ZOOM, duration: 0 });
  }, [meetups, focusId]);

  // Runs after the marker effect above, and only when focusId changes, so changing
  // the category filter doesn't keep re-opening the popup.
  useEffect(() => {
    const map = mapRef.current;
    const marker = focusId ? markersRef.current.get(focusId) : undefined;
    if (!map || !marker) return;
    map.jumpTo({ center: marker.getLngLat(), zoom: FOCUS_ZOOM });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
  }, [focusId]);

  const chip = "min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus";
  const chipState = (on: boolean) => (on ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink-soft hover:border-brand");

  return (
    <div>
      {focusMissing && (
        <p role="status" className="mb-4 rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">
          That meetup isn’t on the map anymore. It may have been cancelled or already started.
        </p>
      )}
      {landmarks.length > 0 && (
        <div role="group" aria-label="Show on map" className="mb-3 inline-flex w-full max-w-md rounded-2xl border border-line bg-surface p-1 shadow-sm sm:w-auto">
          {([
            ["all", `All (${meetups.length + landmarks.length})`],
            ["meetups", `Meetups (${meetups.length})`],
            ["landmarks", `Landmarks (${landmarks.length})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={layer === value}
              onClick={() => setLayer(value)}
              className={`min-h-11 flex-1 rounded-xl px-3 text-sm font-bold whitespace-nowrap max-[359px]:px-1.5 max-[359px]:text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-none sm:px-4 ${layer === value ? "bg-brand text-on-brand shadow-sm" : "text-ink-muted hover:bg-surface-muted hover:text-ink-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {layer !== "landmarks" && (
        <div role="group" aria-label="Filter meetups by category" className="mb-4 flex flex-wrap gap-2">
          <button type="button" aria-pressed={active === "all"} onClick={() => setActive("all")} className={`${chip} ${chipState(active === "all")}`}>
            All categories
          </button>
          {categoryValues.filter((c) => present.has(c)).map((c) => (
            <button key={c} type="button" aria-pressed={active === c} onClick={() => setActive(c)} className={`${chip} ${chipState(active === c)}`}>
              {categories[c].label}
            </button>
          ))}
        </div>
      )}
      {/* Keep this className constant: MapLibre adds its own classes to the container, and
          React rewriting className would remove them and break the map's positioning. */}
      <div ref={ref} aria-label="Map of McGill meetups and landmarks" className={CAMPUS_MAP_FRAME} />
      {layer !== "landmarks" && visible.length === 0 && <p className="mt-3 text-sm text-ink-muted">No upcoming meetups in this category.</p>}
    </div>
  );
}
