// Converts Martlet Drift's world (metres; x east, z south, y up) to map coordinates, so the 3D
// car and the MapLibre campus line up (ADR 0047). Pure: importable by node --test.
import { ORIGIN } from "./drift-streets.ts";

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

export function worldToLngLat(x: number, z: number): { lng: number; lat: number } {
  return { lng: ORIGIN.lng + x / M_PER_DEG_LNG, lat: ORIGIN.lat - z / M_PER_DEG_LAT };
}

export function lngLatToWorld(lng: number, lat: number): { x: number; z: number } {
  return { x: (lng - ORIGIN.lng) * M_PER_DEG_LNG, z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT };
}
