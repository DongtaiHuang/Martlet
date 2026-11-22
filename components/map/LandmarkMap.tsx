"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Map, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUpRight, CheckCircle2, LockKeyhole, UsersRound } from "lucide-react";
import type { LandmarkSummary } from "@/types/landmark";
import { landmarkMarker, landmarkPopupContent } from "./landmark-markers";
import { towerSvg, towerTier } from "./landmark-tower";
import { POPUP_MAX_WIDTH } from "./popup-content";
import { landmarkZoom } from "./landmark-style";
import { CAMPUS_MAP_FRAME, createCampusMap } from "./map-config";
import { useMapColorMode } from "./map-mode";

const PIXEL = 2.25; // tower pixel size: a bit larger than the Explore map's 1.75px
const SELECTED_GLOW = "drop-shadow(0 0 3px #991b1b) drop-shadow(0 0 2px #991b1b)";
const DEFAULT_SHADOW = "drop-shadow(0 2px 2px rgba(0,0,0,.35))";

const isWide = () => window.matchMedia("(min-width: 1024px)").matches;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Landmarks-only map with a scrollable sidebar. Selecting a landmark in the list flies the
 * map to it and opens its popup; clicking a pin highlights it in the list.
 */
export function LandmarkMap({ landmarks }: { landmarks: LandmarkSummary[] }) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  useMapColorMode(mapRef);
  const markers = useRef(new globalThis.Map<string, Marker>());
  const items = useRef(new globalThis.Map<string, HTMLLIElement>());
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!mapEl.current) return;
    // Exactly the Explore map, opening on campus in 3D. (Zooming out to fit the off-campus
    // landmarks would drop below zoom 13, where the map has no 3D buildings; the list flies
    // to those instead.)
    const map = createCampusMap(mapEl.current);

    const byId = markers.current;
    for (const landmark of landmarks) {
      const { element, height } = landmarkMarker(landmark, PIXEL);
      const popup = new Popup({ offset: height + 4, maxWidth: POPUP_MAX_WIDTH })
        .setDOMContent(landmarkPopupContent(landmark, (href) => router.push(href)));
      popup.on("open", () => {
        // One popup at a time, and keep the list in sync.
        byId.forEach((other, id) => { if (id !== landmark.id && other.getPopup()?.isOpen()) other.togglePopup(); });
        setSelected(landmark.id);
      });
      const marker = new Marker({ element, anchor: "bottom" })
        .setLngLat([landmark.longitude, landmark.latitude])
        .setPopup(popup)
        .addTo(map);
      byId.set(landmark.id, marker);
    }
    mapRef.current = map;
    return () => { map.remove(); byId.clear(); mapRef.current = null; };
  }, [landmarks, router]);

  // Highlight the selected pin and bring its list item into view (desktop sidebar only,
  // so phones don't jump down the page).
  useEffect(() => {
    markers.current.forEach((marker, id) => {
      const el = marker.getElement();
      el.style.filter = id === selected ? SELECTED_GLOW : DEFAULT_SHADOW;
      el.style.zIndex = id === selected ? "2" : "";
    });
    if (selected && isWide()) {
      items.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    }
  }, [selected]);

  const focusLandmark = useCallback((landmark: LandmarkSummary) => {
    const map = mapRef.current;
    const marker = markers.current.get(landmark.id);
    if (!map || !marker) return;
    map.flyTo({
      center: [landmark.longitude, landmark.latitude],
      zoom: landmarkZoom(landmark.radius_m),
      duration: reducedMotion() ? 0 : 900,
    });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
    setSelected(landmark.id);
    // On phones the list is below the map: scroll back up so the map is visible.
    if (!isWide()) mapEl.current?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  const unlockedCount = landmarks.filter((l) => l.unlocked).length;

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div
        ref={mapEl}
        role="region"
        aria-label="Map of landmarks"
        className={`${CAMPUS_MAP_FRAME} scroll-mt-4`}
      />

      <aside aria-labelledby="landmark-list-heading" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:h-[65vh] lg:min-h-96">
        <div className="border-b border-line px-4 py-3">
          <h2 id="landmark-list-heading" className="font-bold text-ink-soft">Landmarks</h2>
          <p className="text-xs text-ink-muted">{landmarks.length} to discover · {unlockedCount} unlocked</p>
        </div>
        {/* Scrolls inside: beside the map on desktop, capped below the map on phones. */}
        <ul className="max-h-[60vh] min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto overscroll-contain lg:max-h-none">
          {landmarks.map((landmark) => {
            const active = landmark.id === selected;
            return (
              <li
                key={landmark.id}
                ref={(el) => { if (el) items.current.set(landmark.id, el); else items.current.delete(landmark.id); }}
                className={active ? "bg-brand-soft/70" : undefined}
              >
                <button
                  type="button"
                  onClick={() => focusLandmark(landmark)}
                  aria-pressed={active}
                  className="block w-full px-4 pt-3 pb-2 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold text-ink-soft">
                      {/* Static markup: towerSvg only emits constant colours and numbers. */}
                      <span
                        aria-hidden="true"
                        className="grid h-7 w-6 shrink-0 place-items-end justify-center"
                        dangerouslySetInnerHTML={{ __html: towerSvg(towerTier(landmark.unlock_count), landmark.unlocked, { height: 28 }) }}
                      />
                      {landmark.name}
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${landmark.unlocked ? "bg-ok-soft text-ok-ink" : "bg-surface-muted text-ink-2"}`}>
                      {landmark.unlocked ? <CheckCircle2 aria-hidden="true" size={12} /> : <LockKeyhole aria-hidden="true" size={12} />}
                      {landmark.unlocked ? "Unlocked" : "Locked"}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm text-ink-muted">{landmark.challenge_prompt}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-ink-subtle">
                    <UsersRound aria-hidden="true" size={13} /> {landmark.unlock_count} unlocked
                  </span>
                </button>
                <Link
                  href={`/landmarks/${encodeURIComponent(landmark.id)}`}
                  className="mx-4 mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-bold text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  {landmark.unlocked ? "View photos" : "View challenge"} <ArrowUpRight aria-hidden="true" size={15} />
                </Link>
              </li>
            );
          })}
        </ul>
        {landmarks.length === 0 && <p className="p-4 text-sm text-ink-muted">No landmarks yet.</p>}
      </aside>
    </div>
  );
}
