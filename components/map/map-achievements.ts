// Map triggers for achievements (ADR 0015). Kept out of components/achievements so the
// app-wide toaster doesn't pull in map code.
import type { Map } from "maplibre-gl";
import type { LandmarkSummary } from "@/types/landmark";
import { earn, readStore, writeStore } from "@/components/achievements/earn";
import { CAMPUS_CENTER } from "./map-config";

const OFF_CAMPUS_M = 1500;

function metresFromCampus(lng: number, lat: number) {
  const [cLng, cLat] = CAMPUS_CENTER;
  const x = (lng - cLng) * 111_320 * Math.cos((cLat * Math.PI) / 180);
  const y = (lat - cLat) * 110_540;
  return Math.hypot(x, y);
}

/** Call when a landmark's popup opens: Field trip (off campus) and Tourist (all of them, on this device). */
export function openedLandmark(landmark: LandmarkSummary, total: number) {
  if (metresFromCampus(landmark.longitude, landmark.latitude) > OFF_CAMPUS_M) void earn("field-trip");
  const opened = new Set(readStore<string[]>("martlet:landmarks-opened", []));
  if (opened.has(landmark.id)) return;
  opened.add(landmark.id);
  writeStore("martlet:landmarks-opened", [...opened]);
  if (total > 0 && opened.size >= total) void earn("tourist");
}

/** New angle: the user (not code) tilts or rotates the map. */
export function watchMapAngle(map: Map) {
  const onTurn = (event: { originalEvent?: unknown }) => { if (event.originalEvent) void earn("new-angle"); };
  map.on("pitchstart", onTurn);
  map.on("rotatestart", onTurn);
}
