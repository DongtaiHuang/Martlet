// 3D view for a single meetup map (issue #66): tilted camera, extruded buildings (from the basemap
// or our dark-mode fix), a glowing beacon pillar at the meetup spot, and a gentle orbit.
import type { GeoJSONSource, Map } from "maplibre-gl";

const BEACON = "meetup-beacon";
const RADIUS_M = 7;
const HEIGHT_M = 140;

function circle(lng: number, lat: number, meters: number, steps = 32): [number, number][] {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    return [lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat] as [number, number];
  });
  return [...ring, ring[0]];
}

const brandColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--m-brand").trim() || "#991b1b";

/** Add (or move) the beacon pillar. Safe to call again after a style change. */
export function addBeacon(map: Map, lng: number, lat: number) {
  const data: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { h: HEIGHT_M, r: 1 }, geometry: { type: "Polygon", coordinates: [circle(lng, lat, RADIUS_M)] } },
      { type: "Feature", properties: { h: 6, r: 3 }, geometry: { type: "Polygon", coordinates: [circle(lng, lat, RADIUS_M * 3)] } },
    ],
  };
  const source = map.getSource(BEACON) as GeoJSONSource | undefined;
  if (source) { source.setData(data); return; }
  map.addSource(BEACON, { type: "geojson", data });
  map.addLayer({
    id: BEACON,
    type: "fill-extrusion",
    source: BEACON,
    paint: {
      "fill-extrusion-color": brandColor(),
      "fill-extrusion-height": ["get", "h"],
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.7,
    },
  });
}

export function removeBeacon(map: Map) {
  if (map.getLayer(BEACON)) map.removeLayer(BEACON);
  if (map.getSource(BEACON)) map.removeSource(BEACON);
}

/** Slowly circle the meetup spot until the user grabs the map. Returns a stop function. */
export function startOrbit(map: Map, degreesPerSecond = 6): () => void {
  let raf = 0, last = 0, stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    for (const e of ["mousedown", "touchstart", "wheel", "dragstart"] as const) map.off(e, stop);
  };
  const tick = (t: number) => {
    if (stopped) return;
    if (last && !map.isMoving()) map.setBearing(map.getBearing() + ((t - last) / 1000) * degreesPerSecond);
    last = t;
    raf = requestAnimationFrame(tick);
  };
  for (const e of ["mousedown", "touchstart", "wheel", "dragstart"] as const) map.on(e, stop);
  raf = requestAnimationFrame(tick);
  return stop;
}

/** Let people rotate/tilt the map themselves while in 3D; lock it again in 2D. */
export function setRotateTilt(map: Map, enabled: boolean) {
  if (enabled) { map.dragRotate.enable(); map.touchPitch.enable(); map.touchZoomRotate.enableRotation(); }
  else { map.dragRotate.disable(); map.touchPitch.disable(); map.touchZoomRotate.disableRotation(); }
}
