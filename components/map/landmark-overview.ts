import { LngLatBounds, type Map, type Marker } from "maplibre-gl";
import { DEFAULT_DARK_STYLE_URL, DEFAULT_STYLE_URL } from "./map-style";

const OVERVIEW_PITCH = 62;
const DETAIL_ZOOM = 14;
const BUILDING_SOURCE = "landmark-overview-buildings";

export function fitLandmarkOverview(map: Map, markers: Iterable<Marker>, maxZoom: number) {
  const bounds = new LngLatBounds();
  for (const marker of markers) bounds.extend(marker.getLngLat());

  map.setMaxPitch(70);
  map.fitBounds(bounds, {
    pitch: OVERVIEW_PITCH,
    padding: { top: 96, bottom: 48, left: 56, right: 56 },
    maxZoom,
    duration: 0,
  });
}

/** Fetch nearby building tiles at their native detail while the overview is zoomed out. */
export function addOverviewBuildings(map: Map) {
  const url = map.getStyleUrl();
  if (url !== DEFAULT_STYLE_URL && url !== DEFAULT_DARK_STYLE_URL) return;

  const style = map.getStyle();
  const source = style.sources.openmaptiles;
  const buildings = style.layers.find((layer) => layer.id === "building-3d");
  if (source?.type !== "vector" || buildings?.type !== "fill-extrusion" || map.getSource(BUILDING_SOURCE)) return;

  map.addSource(BUILDING_SOURCE, {
    ...source,
    bounds: [-73.63, 45.48, -73.54, 45.54],
    minzoom: DETAIL_ZOOM,
    maxzoom: DETAIL_ZOOM,
  });
  // MapLibre uses dynamic tile zoom above 60° of pitch. Keep only this bounded
  // source at zoom 14 so the basemap can still use its normal overview tiles.
  const overviewSource = map.getSource(BUILDING_SOURCE);
  if (overviewSource) overviewSource.calculateTileZoom = () => DETAIL_ZOOM;
  map.addLayer({
    ...buildings,
    id: BUILDING_SOURCE,
    source: BUILDING_SOURCE,
    minzoom: 10,
    // The worker parses at tile zoom 14, so the layer's maxzoom must be higher.
    maxzoom: DETAIL_ZOOM + 1,
    paint: {
      ...buildings.paint,
      "fill-extrusion-opacity": ["step", ["zoom"], url === DEFAULT_DARK_STYLE_URL ? 0.85 : 0.8, DETAIL_ZOOM, 0],
    },
  }, buildings.id);
}

/** Give nearby tower pins room in the overview, restoring their exact positions at detail zoom. */
export function spaceOverviewPins(map: Map, markers: Iterable<Marker>) {
  const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
  const width = map.getCanvas().clientWidth;
  for (const marker of markers) {
    marker.setOffset([0, 0]);
    if (map.getZoom() >= DETAIL_ZOOM) continue;

    const { x, y } = map.project(marker.getLngLat());
    const { offsetWidth, offsetHeight } = marker.getElement();
    const half = offsetWidth / 2;
    const top = y - offsetHeight;
    const step = offsetWidth + 4;
    for (const offset of [0, step, -step, 2 * step, -2 * step]) {
      const left = x + offset - half;
      const right = x + offset + half;
      if (left < 4 || right > width - 4) continue;
      if (occupied.some((pin) => left < pin.right + 4 && right > pin.left - 4 && top < pin.bottom && y > pin.top)) continue;
      marker.setOffset([offset, 0]);
      occupied.push({ left, right, top, bottom: y });
      break;
    }
  }
}
